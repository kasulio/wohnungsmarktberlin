import { and, count, eq, sql } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { db } from "~/server/db/client";
import { flat } from "~/server/db/schema";

export const statsRouter = router({
  getActivityStats: publicProcedure.query(async () => {
    const byDayOfWeek = await db
      .select({
        day: sql<number>`CAST(strftime('%w', datetime(${flat.firstSeen}, 'unixepoch', 'localtime')) AS INTEGER)`.as(
          "day",
        ),
        count: count(),
      })
      .from(flat)
      .where(and(eq(flat.ignored, false)))
      .groupBy(sql`day`)
      .orderBy(sql`day`);

    const byHourOfDay = await db
      .select({
        hour: sql<number>`CAST(strftime('%H', datetime(${flat.firstSeen}, 'unixepoch', 'localtime')) AS INTEGER)`.as(
          "hour",
        ),
        count: count(),
      })
      .from(flat)
      .where(and(eq(flat.ignored, false)))
      .groupBy(sql`hour`)
      .orderBy(sql`hour`);

    const byWeek = await db
      .select({
        week: sql<string>`strftime('%Y-%W', datetime(${flat.firstSeen}, 'unixepoch', 'localtime'))`.as(
          "week",
        ),
        count: count(),
      })
      .from(flat)
      .where(and(eq(flat.ignored, false)))
      .groupBy(sql`week`)
      .orderBy(sql`week`);

    return { byDayOfWeek, byHourOfDay, byWeek };
  }),
});
