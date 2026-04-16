import { z } from "zod";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { propertyManagements } from "~/data/propertyManagements";
import { db } from "~/server/db/client";
import {
  flat,
  flatUrlJob,
  propertyManagement,
  scraperRun,
} from "~/server/db/schema";
import { logScraperRun } from "~/server/lib/scraper/log-scraper-run";
import { processFlatUrlJobs } from "~/server/lib/scraper/process-flat-url-jobs";
import { pruneFlatsNotSeenForDays } from "~/server/lib/scraper/prune-stale-flats";
import {
  type SyncListingsStats,
  syncListingsForPropertyManagement,
} from "~/server/lib/scraper/sync-listings";
import {
  publicProcedure,
  protectedProcedure,
  router,
} from "../trpc";

const ADMIN_EXTRACT_JOB_LIMIT = 40;

const isConfiguredPm = (slug: string): slug is keyof typeof propertyManagements =>
  Object.hasOwn(propertyManagements, slug);

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

  getScraperOverview: protectedProcedure.query(async () => {
    const activeSlugs = await db
      .select({ slug: propertyManagement.slug })
      .from(propertyManagement)
      .where(eq(propertyManagement.active, true))
      .then((rows) => rows.map((r) => r.slug));

    const byStatus = await db
      .select({
        status: flatUrlJob.status,
        cnt: count(),
      })
      .from(flatUrlJob)
      .groupBy(flatUrlJob.status);

    const global = {
      pending: 0,
      failed: 0,
      completed: 0,
    };
    for (const row of byStatus) {
      if (row.status === "pending") global.pending = row.cnt;
      else if (row.status === "failed") global.failed = row.cnt;
      else if (row.status === "completed") global.completed = row.cnt;
    }

    const perPmRows = await db
      .select({
        propertyManagementId: flatUrlJob.propertyManagementId,
        status: flatUrlJob.status,
        cnt: count(),
      })
      .from(flatUrlJob)
      .groupBy(flatUrlJob.propertyManagementId, flatUrlJob.status);

    const pmMap = new Map<
      string,
      { pending: number; failed: number; completed: number }
    >();
    for (const row of perPmRows) {
      let entry = pmMap.get(row.propertyManagementId);
      if (!entry) {
        entry = { pending: 0, failed: 0, completed: 0 };
        pmMap.set(row.propertyManagementId, entry);
      }
      if (row.status === "pending") entry.pending = row.cnt;
      else if (row.status === "failed") entry.failed = row.cnt;
      else if (row.status === "completed") entry.completed = row.cnt;
    }

    const oldestPending = await db
      .select({
        createdAt: flatUrlJob.createdAt,
        url: flatUrlJob.url,
        propertyManagementId: flatUrlJob.propertyManagementId,
      })
      .from(flatUrlJob)
      .where(eq(flatUrlJob.status, "pending"))
      .orderBy(asc(flatUrlJob.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const failedJobs = await db
      .select({
        url: flatUrlJob.url,
        propertyManagementId: flatUrlJob.propertyManagementId,
      })
      .from(flatUrlJob)
      .where(eq(flatUrlJob.status, "failed"))
      .orderBy(desc(flatUrlJob.createdAt))
      .limit(60);

    const failedSamplesByPm = new Map<string, { url: string }[]>();
    for (const job of failedJobs) {
      const list = failedSamplesByPm.get(job.propertyManagementId) ?? [];
      if (list.length < 3) {
        list.push({ url: job.url });
        failedSamplesByPm.set(job.propertyManagementId, list);
      }
    }

    const perPropertyManagement = activeSlugs.map((slug) => {
      const counts = pmMap.get(slug) ?? {
        pending: 0,
        failed: 0,
        completed: 0,
      };
      return {
        slug,
        ...counts,
        failedSamples: failedSamplesByPm.get(slug) ?? [],
      };
    });

    const recentRuns = await db
      .select({
        id: scraperRun.id,
        kind: scraperRun.kind,
        propertyManagementId: scraperRun.propertyManagementId,
        success: scraperRun.success,
        trigger: scraperRun.trigger,
        createdAt: scraperRun.createdAt,
        durationMs: scraperRun.durationMs,
        statsJson: scraperRun.statsJson,
      })
      .from(scraperRun)
      .orderBy(desc(scraperRun.createdAt))
      .limit(20);

    return {
      global: {
        ...global,
        oldestPending: oldestPending
          ? {
              createdAt: oldestPending.createdAt,
              url: oldestPending.url,
              propertyManagementId: oldestPending.propertyManagementId,
            }
          : null,
      },
      perPropertyManagement,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        kind: r.kind,
        propertyManagementId: r.propertyManagementId,
        success: r.success,
        trigger: r.trigger,
        createdAt: r.createdAt,
        durationMs: r.durationMs,
        statsSummary: summarizeStatsJson(r.statsJson),
      })),
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        slugs: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const started = Date.now();
      const activeRows = await db
        .select({ slug: propertyManagement.slug })
        .from(propertyManagement)
        .where(eq(propertyManagement.active, true));

      const activeSet = new Set(activeRows.map((r) => r.slug));
      const scoped = Boolean(input.slugs?.length);

      let targetSlugs: string[];
      if (scoped) {
        targetSlugs =
          input.slugs?.filter(
            (s) => activeSet.has(s) && isConfiguredPm(s),
          ) ?? [];
      } else {
        targetSlugs = activeRows
          .map((r) => r.slug)
          .filter((s) => isConfiguredPm(s));
      }

      await pruneFlatsNotSeenForDays(7);

      const syncResults: Array<{
        slug: string;
        success: boolean;
        stats: SyncListingsStats;
        error?: string;
      }> = [];

      for (const slug of targetSlugs) {
        const r = await syncListingsForPropertyManagement(slug);
        syncResults.push({
          slug,
          success: r.success,
          stats: r.stats,
          error: r.error,
        });
      }

      const { stats: extractionStats } = await processFlatUrlJobs({
        limit: ADMIN_EXTRACT_JOB_LIMIT,
        propertyManagementIds: scoped ? targetSlugs : undefined,
        sleepBetweenJobs: false,
      });

      const pendingRemaining = extractionStats.flatsPending;

      const payload = {
        syncResults,
        extractionStats,
        pendingRemaining,
      };

      const syncOk = syncResults.every((s) => s.success);
      const extractOk = extractionStats.flatsFailed === 0;
      const runOk = syncOk && extractOk;

      await logScraperRun({
        kind: "admin-scrape",
        propertyManagementId: null,
        success: runOk,
        stats: payload,
        errorMessage: runOk
          ? null
          : [
              ...syncResults
                .filter((s) => !s.success)
                .map((s) => `${s.slug}: ${s.error ?? "unknown"}`),
              ...(extractOk
                ? []
                : [`extract: ${extractionStats.flatsFailed} fehlgeschlagen`]),
            ].join("; "),
        durationMs: Date.now() - started,
        trigger: "admin",
      });

      return payload;
    }),
});

function summarizeStatsJson(raw: string): string {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o).slice(0, 4);
      const short: Record<string, unknown> = {};
      for (const k of keys) short[k] = o[k];
      return JSON.stringify(short);
    }
    return raw.slice(0, 120);
  } catch {
    return raw.slice(0, 120);
  }
}
