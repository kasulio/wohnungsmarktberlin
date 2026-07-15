import { and, eq, sql, getTableColumns, count, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db } from "~/server/db/client";
import { address, flat } from "~/server/db/schema";
import { getDisplayTags } from "~/data/tags";
import { flatFilterUrlSchema } from "~/composables/useUrlState";
import {
  flatFilterToSql,
  isFlatNew,
  type FlatFilter,
} from "~/lib/flat-filters";
import { publishableFlatFilter } from "~/lib/flat-publishability";
import { hashString } from "~/server/util";

export const countsAsNewFilter = sql<0 | 1>`${isFlatNew}`.as("isNew");

const queryOptions = {
  where: publishableFlatFilter(),
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
      const filter: FlatFilter = {
        ids: input.ids ?? undefined,
        tags: input.tags ?? undefined,
        propertyManagements: input.propertyManagements ?? undefined,
        districts: input.districts ?? undefined,
        priceMin: input.priceMin,
        priceMax: input.priceMax,
        roomsMin: input.roomsMin,
        roomsMax: input.roomsMax,
        areaMin: input.areaMin,
        areaMax: input.areaMax,
      };

      const whereClause = and(
        publishableFlatFilter(),
        ...flatFilterToSql(filter),
      );

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
            .where(publishableFlatFilter())
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
        // SQLite rejects `NULLS LAST` before ASC/DESC; use IS NULL instead.
        const pricePerSqm = sql`COALESCE(${flat.warmRentPrice}, ${flat.coldRentPrice}) / NULLIF(${flat.usableArea}, 0)`;
        orderByInput.push(sql`${pricePerSqm} IS NULL`, orderFunc(pricePerSqm));
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
        .where(publishableFlatFilter())
    ).map((x) => x.id);

    return await hashString(flatIds.join(""));
  }),
});
