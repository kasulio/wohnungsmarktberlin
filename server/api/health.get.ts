import { sql } from "drizzle-orm";
import { db } from "~/server/db/client";

export default defineEventHandler(async (event) => {
  try {
    await db.run(sql`SELECT 1`);
    return { status: "ok" };
  } catch (error) {
    setResponseStatus(event, 503);
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "db unavailable",
    };
  }
});
