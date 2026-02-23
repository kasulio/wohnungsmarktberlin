import { eq, count, sql } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { db } from "~/server/db/client";
import { propertyManagement, flat } from "~/server/db/schema";

export const propertyManagementRouter = router({
  getAll: publicProcedure.query(async () => {
    return await db
      .select({
        slug: propertyManagement.slug,
        name: propertyManagement.name,
        website: propertyManagement.website,
        active: propertyManagement.active,
        flatCount: count(flat.id),
        activeFlatCount: sql<number>`sum(case when ${flat.deleted} is null and ${flat.ignored} = 0 then 1 else 0 end)`,
      })
      .from(propertyManagement)
      .leftJoin(flat, eq(flat.propertyManagementId, propertyManagement.slug))
      .where(eq(propertyManagement.active, true))
      .groupBy(propertyManagement.slug);
  }),
});
