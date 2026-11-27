import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { env } from "~/env";
import { auth } from "~/lib/auth";
import { publishableFlatFilter } from "~/lib/flat-publishability";
import { db } from "~/server/db/client";
import { flat, flatUrlJob } from "~/server/db/schema";
import { evaluateTaskHeartbeats } from "~/server/lib/pipeline-health";

const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

/**
 * Deeper operational health endpoint for external monitors (e.g. Uptime Kuma,
 * Better Stack) and operators. Unlike `/api/health` (which only checks DB
 * connectivity for Docker restarts), this inspects cron heartbeats, queue
 * staleness, and geocoding failures.
 *
 * When `HEALTH_CHECK_TOKEN` is set, requires either `Authorization: Bearer <token>`,
 * `?token=<token>`, or an authenticated admin session.
 * Pass `?strict=1` to return HTTP 503 when `status === "degraded"`.
 */
export default defineEventHandler(async (event) => {
  if (env.HEALTH_CHECK_TOKEN) {
    const authHeader = getHeader(event, "authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;
    const queryToken = getQuery(event).token;
    const tokenOk =
      bearer === env.HEALTH_CHECK_TOKEN ||
      queryToken === env.HEALTH_CHECK_TOKEN;

    if (!tokenOk) {
      const session = await auth.api.getSession({ headers: event.headers });
      if (!session?.user?.id) {
        throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
      }
    }
  }

  try {
    await db.run(sql`SELECT 1`);
  } catch (error) {
    setResponseStatus(event, 503);
    return {
      status: "unhealthy" as const,
      error: error instanceof Error ? error.message : "db unavailable",
    };
  }

  const [jobStatusRows, oldestPendingRow, geocodeRows, visibleRow] =
    await Promise.all([
      db
        .select({ status: flatUrlJob.status, cnt: count() })
        .from(flatUrlJob)
        .groupBy(flatUrlJob.status),
      db
        .select({ createdAt: flatUrlJob.createdAt })
        .from(flatUrlJob)
        .where(eq(flatUrlJob.status, "pending"))
        .orderBy(asc(flatUrlJob.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ status: flat.addressImprovement, cnt: count() })
        .from(flat)
        .where(and(isNull(flat.deleted), eq(flat.ignored, false)))
        .groupBy(flat.addressImprovement),
      db
        .select({ cnt: count() })
        .from(flat)
        .where(publishableFlatFilter())
        .then((rows) => rows[0]?.cnt ?? 0),
    ]);

  const queue = {
    pending: 0,
    failed: 0,
    completed: 0,
    oldestPendingAt: oldestPendingRow?.createdAt.toISOString() ?? null,
  };
  for (const row of jobStatusRows) {
    if (row.status === "pending") queue.pending = row.cnt;
    else if (row.status === "failed") queue.failed = row.cnt;
    else if (row.status === "completed") queue.completed = row.cnt;
  }

  const geocoding = { pending: 0, failed: 0, success: 0 };
  for (const row of geocodeRows) {
    if (row.status === "pending") geocoding.pending = row.cnt;
    else if (row.status === "failed") geocoding.failed = row.cnt;
    else if (row.status === "success") geocoding.success = row.cnt;
  }

  const heartbeat = evaluateTaskHeartbeats({
    scheduledTasksEnabled: env.SCHEDULED_TASKS !== "off",
  });

  const issues = [...heartbeat.issues];
  if (
    oldestPendingRow &&
    Date.now() - oldestPendingRow.createdAt.getTime() > STALE_PENDING_MS
  ) {
    issues.push(
      `oldest pending flatUrlJob is older than 24h (${oldestPendingRow.createdAt.toISOString()})`,
    );
  }
  if (queue.failed > 0) {
    issues.push(`${queue.failed} failed flatUrlJob(s) in queue`);
  }

  const status = issues.length === 0 ? ("ok" as const) : ("degraded" as const);
  const strict = getQuery(event).strict === "1";
  if (strict && status !== "ok") {
    setResponseStatus(event, 503);
  }

  return {
    status,
    uptimeSeconds: heartbeat.uptimeSeconds,
    scheduledTasksEnabled: heartbeat.scheduledTasksEnabled,
    issues,
    flats: { visible: visibleRow },
    queue,
    geocoding,
    tasks: heartbeat.tasks,
  };
});
