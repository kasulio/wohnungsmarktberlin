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
} from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db } from "~/db/db";
import { address, flat, flatToTag } from "~/db/schema";
import { omit } from "~/utils/typeHelper";
import { berlinDistricts, districtIdSchema } from "~/data/districts";
import { type Tags, tagsSchema } from "~/data/tags";
import { flatFilterUrlSchema } from "~/composables/useUrlState";
import { hashString } from "~/server/util";

const countsAsNewTime = 60 * 60 * 12;
export const countsAsNewFilter = sql<
  0 | 1
>`strftime('%s', 'now') - firstSeen < ${countsAsNewTime}`.as("isNew");

const queryOptions = {
  where: isNull(flat.deleted),
  with: { address: true, flatToTag: true },
  columns: {
    id: true,
    addressId: true,
    coldRentPrice: true,
    floor: true,
    propertyManagementId: true,
    tags: true,
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
      ).map((flat) => {
        const tags = flat.flatToTag.map((flatToTag) => flatToTag.tagId);
        if (flat.isNew) {
          tags.push("new");
        }
        return { ...flat, tags };
      });
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
      // when filtering for "new", we need to filter
      // for the timestamp instead of the tag
      const onlyShowNew = input.tags?.includes("new");
      if (onlyShowNew) {
        input.tags = input.tags?.filter((tag) => tag !== "new");
      }
      const tagsToFilterFor = tagsSchema.safeParse(input.tags ?? []);
      const filters = [
        // not deleted
        isNull(flat.deleted),

        // id filter
        input.ids &&
          (input.ids.length ? inArray(flat.id, input.ids) : sql`FALSE`),

        // property management filter
        input.propertyManagements &&
          inArray(flat.propertyManagementId, input.propertyManagements),

        // district filter
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

        // countsAsNew filter
        onlyShowNew && sql`isNew = 1`,

        // tag filter
        tagsToFilterFor.success &&
          tagsToFilterFor.data.length > 0 &&
          inArray(flatToTag.tagId, tagsToFilterFor.data),

        // price filter
        // TODO: besseres handling für kalt/warmmiete
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

        // room count filter
        input.roomsMin && gte(flat.roomCount, input.roomsMin),
        input.roomsMax && lte(flat.roomCount, input.roomsMax),

        // usable area filter
        input.areaMin && gte(flat.usableArea, input.areaMin),
        input.areaMax && lte(flat.usableArea, input.areaMax),
      ].filter(Boolean);

      const filteredElementsCount = (
        await db
          .select({
            count: count(),
            isNew: countsAsNewFilter,
          })
          .from(flat)
          .leftJoin(flatToTag, eq(flat.id, flatToTag.flatId))
          .innerJoin(address, eq(flat.addressId, address.id))
          .groupBy(flat.id)
          .where(and(...filters))
      ).length;

      const totalElementsCount = (
        await db
          .select({
            count: count(),
          })
          .from(flat)
          .where(isNull(flat.deleted))
      )[0].count;

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
            sql`COALESCE(${flat.warmRentPrice}, ${flat.coldRentPrice}) / ${flat.usableArea}`,
          ),
        );
      } else {
        orderByInput.push(orderFunc(flat[input.orderBy?.[0]]));
      }

      // get the flatIds of all flats that fulfill the filters
      const flatIdsQuery = db
        .select({
          id: flat.id,
          isNew: countsAsNewFilter,
          postalCode: address.postalCode,
        })
        .from(flat)
        .leftJoin(flatToTag, eq(flat.id, flatToTag.flatId))
        .innerJoin(address, eq(flat.addressId, address.id))
        .groupBy(flat.id)
        .where(and(...filters))
        .orderBy(...orderByInput)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      // run the full query, there will be multiples, because of the m:n relation to the tags
      const query = db
        .select({
          flat: { ...getTableColumns(flat), isNew: sql`isNew` },
          address: getTableColumns(address),
          flatToTag: getTableColumns(flatToTag),
        })
        .from(flatIdsQuery.as("flatIdQuery"))
        .innerJoin(flat, eq(flat.id, sql`flatIdQuery.id`))
        .innerJoin(address, eq(flat.addressId, address.id))
        .leftJoin(flatToTag, eq(flat.id, flatToTag.flatId));

      // filter out the multiples and bring it into the correct format
      const data = (await query).reduce(
        (acc, dataPoint) => {
          const flat = omit(dataPoint.flat, ["deleted", "image"]);
          // create the flat object for the first time
          if (!acc[dataPoint.flat.id]) {
            acc[dataPoint.flat.id] = {
              ...flat,
              tags: flat.isNew ? ["new"] : [],
              hasImage: !!dataPoint.flat.image,
              address: dataPoint.address,
            };
          }

          // add current tag
          if (dataPoint.flatToTag?.tagId) {
            acc[dataPoint.flat.id].tags.push(dataPoint.flatToTag.tagId);
          }

          return acc;
        },
        {} as Record<
          string,
          Omit<typeof flat.$inferSelect, "image" | "deleted"> & {
            tags: Tags;
            hasImage: boolean;
            address: typeof address.$inferSelect;
          }
        >,
      );

      return {
        totalElementsCount,
        filteredElementsCount,
        data: Object.values(data),
      };
    }),
  getMapPreviewHash: publicProcedure.query(async () => {
    const flatIds = (
      await db
        .select({
          id: flat.id,
        })
        .from(flat)
        .where(isNull(flat.deleted))
    ).map((x) => x.id);

    return await hashString(flatIds.join(""));
  }),
});
