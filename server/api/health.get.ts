import { and, count, eq, gte } from "drizzle-orm";
import { db } from "~/server/db/client";
import { flatUrlJob } from "~/server/db/schema";

const FAILED_JOBS_WINDOW_MS = 12 * 60 * 60 * 1000;
const FAILED_JOBS_THRESHOLD = 20;

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: false });
  if (ip !== "127.0.0.1" && ip !== "::1") {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  try {
    const since = new Date(Date.now() - FAILED_JOBS_WINDOW_MS);
    const row = await db
      .select({ c: count() })
      .from(flatUrlJob)
      .where(
        and(eq(flatUrlJob.status, "failed"), gte(flatUrlJob.createdAt, since)),
      )
      .then((r) => r[0]);

    const failedJobs = row?.c ?? 0;
    if (failedJobs >= FAILED_JOBS_THRESHOLD) {
      setResponseStatus(event, 503);
      return {
        status: "unhealthy",
        db: "ok",
        failedJobs,
        failedJobsThreshold: FAILED_JOBS_THRESHOLD,
        failedJobsWindowHours: 12,
      };
    }

    return {
      status: "ok",
      db: "ok",
      failedJobs,
    };
  } catch (error) {
    setResponseStatus(event, 503);
    return {
      status: "unhealthy",
      db: "error",
      failedJobs: null,
      error: error instanceof Error ? error.message : "db unavailable",
    };
  }
});
