import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { db } from "~/server/db/client";

export const propertyManagementRouter = router({
  getAll: publicProcedure.query(async () => {
    return await db.query.propertyManagement.findMany({
      with: {
        flats: {
          columns: {
            id: true,
            title: true,
          },
          extras: {
            isActive: sql<0 | 1>`deleted IS NULL`.as("isActive"),
          },
        },
      },
    });
  }),
});
