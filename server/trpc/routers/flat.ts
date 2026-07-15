import {
  and,
  eq,
  inArray,
  isNull,
  sql,
  getTableColumns,
  gte,
  lte,
  count,
  or,
  asc,
  desc,
  isNotNull,
} from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db } from "~/server/db/client";
import { address, flat } from "~/server/db/schema";
import { berlinDistricts, districtIdSchema } from "~/data/districts";
import {
  getDisplayTags,
  tagsSchema,
  titleMatchesAnyTagFilter,
} from "~/data/tags";
import { flatFilterUrlSchema } from "~/composables/useUrlState";
import { hashString } from "~/server/util";

const countsAsNewTime = 60 * 60 * 12;
const isFlatNew = sql`strftime('%s', 'now') - ${flat.firstSeen} < ${countsAsNewTime}`;
export const countsAsNewFilter = sql<0 | 1>`${isFlatNew}`.as("isNew");

const queryOptions = {
  where: and(
    isNull(flat.deleted),
    isNotNull(flat.addressId),
    eq(flat.ignored, false),
  ),
  with: { address: true },
  columns: {
    id: true,
    addressId: true,
    coldRentPrice: true,
    floor: true,
    propertyManagementId: true,
    title: true,
    firstSeen: true,
    lastSeen: true,
    roomCount: true,
    usableArea: true,
    warmRentPrice: true,
    url: true,
  },
  extras: {
    hasImage: sql<0 | 1>`image IS NOT NULL`.as("hasImage"),
    isNew: countsAsNewFilter,
  },
} as const;

export const flatRouter = router({
  getFeatured: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().prefault(8),
      }),
    )
    .query(async ({ input }) => {
      return (
        await db.query.flat.findMany({
          ...queryOptions,
          limit: input.limit,
          orderBy: [desc(flat.firstSeen)],
        })
      ).map((flat) => ({
        ...flat,
        hasImage: !!flat.hasImage,
        tags: getDisplayTags(flat.title, !!flat.isNew),
      }));
    }),
  getAll: publicProcedure
    .input(
      flatFilterUrlSchema
        .optional()
        .default({})
        .transform((input) => {
          return {
            ...input,
            page: input.page?.[0] ?? 1,
            pageSize: input.pageSize?.[0] ?? 25,
            areaMin: input.areaMin?.[0],
            areaMax: input.areaMax?.[0],
            priceMin: input.priceMin?.[0],
            priceMax: input.priceMax?.[0],
            roomsMin: input.roomsMin?.[0],
            roomsMax: input.roomsMax?.[0],
          };
        }),
    )
    .query(async ({ input }) => {
      const onlyShowNew = input.tags?.includes("new");
      const tagsWithoutNew = input.tags?.filter((tag) => tag !== "new");
      const tagsToFilterFor = tagsSchema.safeParse(tagsWithoutNew ?? []);

      const tagFilter =
        tagsToFilterFor.success && tagsToFilterFor.data.length > 0
          ? titleMatchesAnyTagFilter(flat.title, tagsToFilterFor.data)
          : undefined;

      const filters = [
        isNull(flat.deleted),
        eq(flat.ignored, false),
        input.ids &&
          (input.ids.length ? inArray(flat.id, input.ids) : sql`FALSE`),
        input.propertyManagements &&
          inArray(flat.propertyManagementId, input.propertyManagements),
        input.districts &&
          inArray(
            address.postalCode,
            input.districts
              .map((inputDistrict) => {
                const res = districtIdSchema.safeParse(inputDistrict);
                if (!res.success) return [];
                return berlinDistricts[res.data].zipCodes;
              })
              .flat(),
          ),
        onlyShowNew && isFlatNew,
        tagFilter,
        input.priceMin &&
          or(
            gte(flat.warmRentPrice, input.priceMin),
            gte(flat.coldRentPrice, input.priceMin),
          ),
        input.priceMax &&
          or(
            lte(flat.warmRentPrice, input.priceMax),
            lte(flat.coldRentPrice, input.priceMax),
          ),
        input.roomsMin &&
          and(isNotNull(flat.roomCount), gte(flat.roomCount, input.roomsMin)),
        input.roomsMax &&
          and(isNotNull(flat.roomCount), lte(flat.roomCount, input.roomsMax)),
        input.areaMin &&
          and(isNotNull(flat.usableArea), gte(flat.usableArea, input.areaMin)),
        input.areaMax &&
          and(isNotNull(flat.usableArea), lte(flat.usableArea, input.areaMax)),
      ].filter(Boolean);

      const whereClause = and(...filters);

      const filteredElementsCount =
        (
          await db
            .select({ count: count() })
            .from(flat)
            .innerJoin(address, eq(flat.addressId, address.id))
            .where(whereClause)
        )[0]?.count ?? 0;

      const totalElementsCount =
        (
          await db
            .select({ count: count() })
            .from(flat)
            .where(
              and(
                isNull(flat.deleted),
                isNotNull(flat.addressId),
                eq(flat.ignored, false),
              ),
            )
        )[0]?.count ?? 0;

      const orderByInput = [];
      const orderFunc = input.order?.[0] === "asc" ? asc : desc;

      if (!input.orderBy?.[0] || input.orderBy?.[0] === "main") {
        orderByInput.push(orderFunc(flat.firstSeen));
      } else if (input.orderBy?.[0] === "price") {
        orderByInput.push(
          orderFunc(
            sql`COALESCE(${flat.warmRentPrice}, ${flat.coldRentPrice})`,
          ),
        );
      } else if (input.orderBy?.[0] === "rentPricePerSquareMeter") {
        orderByInput.push(
          orderFunc(
            sql`COALESCE(${flat.warmRentPrice}, ${flat.coldRentPrice}) / NULLIF(${flat.usableArea}, 0) NULLS LAST`,
          ),
        );
      } else {
        orderByInput.push(orderFunc(flat[input.orderBy?.[0]]));
      }

      const rows = await db
        .select({
          flat: { ...getTableColumns(flat), isNew: countsAsNewFilter },
          address: getTableColumns(address),
        })
        .from(flat)
        .innerJoin(address, eq(flat.addressId, address.id))
        .where(whereClause)
        .orderBy(...orderByInput)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const data = rows.map(({ flat: flatRow, address: flatAddress }) => {
        const { image, isNew, ...rest } = flatRow;
        return {
          ...rest,
          tags: getDisplayTags(flatRow.title, !!isNew),
          hasImage: !!image,
          address: flatAddress,
        };
      });

      return {
        totalElementsCount,
        filteredElementsCount,
        data,
      };
    }),
  getMapPreviewHash: publicProcedure.query(async () => {
    const flatIds = (
      await db
        .select({
          id: flat.id,
        })
        .from(flat)
        .where(and(isNull(flat.deleted), eq(flat.ignored, false)))
    ).map((x) => x.id);

    return await hashString(flatIds.join(""));
  }),
});
