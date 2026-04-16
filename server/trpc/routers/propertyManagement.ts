import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, min, sql } from "drizzle-orm";
import { propertyManagements } from "~/data/propertyManagements";
import { env } from "~/env";
import { db } from "~/server/db/client";
import {
  flat,
  flatUrlJob,
  propertyManagement,
  scraperRun,
} from "~/server/db/schema";
import { logScraperRun } from "~/server/lib/scraper/log-scraper-run";
import {
  type ProcessFlatUrlJobsStats,
  processFlatUrlJobs,
} from "~/server/lib/scraper/process-flat-url-jobs";
import { pruneFlatsNotSeenForDays } from "~/server/lib/scraper/prune-stale-flats";
import {
  type SyncListingsStats,
  syncListingsForPropertyManagement,
} from "~/server/lib/scraper/sync-listings";
import { publicProcedure, protectedProcedure, router } from "../trpc";

/** In-memory only; multi-instance deploy needs shared lock (see follow-up plan). */
const ADMIN_SCRAPE_COOLDOWN_MS = 30_000;
const adminScrapeCooldownGlobal = "__admin_scrape_all__";
const adminScrapeLastAt = new Map<string, number>();

const isConfiguredPm = (
  slug: string,
): slug is keyof typeof propertyManagements =>
  Object.hasOwn(propertyManagements, slug);

async function countPendingJobs(
  propertyManagementIds?: string[],
): Promise<number> {
  const where =
    propertyManagementIds && propertyManagementIds.length > 0
      ? and(
          eq(flatUrlJob.status, "pending"),
          inArray(flatUrlJob.propertyManagementId, propertyManagementIds),
        )
      : eq(flatUrlJob.status, "pending");
  const row = await db
    .select({ c: count() })
    .from(flatUrlJob)
    .where(where)
    .then((r) => r[0]);
  return row?.c ?? 0;
}

async function lastSuccessfulRunCreatedAt(kind: string): Promise<Date | null> {
  const row = await db
    .select({ createdAt: scraperRun.createdAt })
    .from(scraperRun)
    .where(and(eq(scraperRun.kind, kind), eq(scraperRun.success, true)))
    .orderBy(desc(scraperRun.createdAt))
    .limit(1)
    .then((r) => r[0]);
  return row?.createdAt ?? null;
}

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
        lastError: flatUrlJob.lastError,
      })
      .from(flatUrlJob)
      .where(eq(flatUrlJob.status, "failed"))
      .orderBy(desc(flatUrlJob.createdAt))
      .limit(60);

    const failedSamplesByPm = new Map<
      string,
      { url: string; lastError: string | null }[]
    >();
    for (const job of failedJobs) {
      const list = failedSamplesByPm.get(job.propertyManagementId) ?? [];
      if (list.length < 3) {
        list.push({ url: job.url, lastError: job.lastError ?? null });
        failedSamplesByPm.set(job.propertyManagementId, list);
      }
    }

    const oldestPendingRows = await db
      .select({
        propertyManagementId: flatUrlJob.propertyManagementId,
        oldestPendingAt: min(flatUrlJob.createdAt),
      })
      .from(flatUrlJob)
      .where(eq(flatUrlJob.status, "pending"))
      .groupBy(flatUrlJob.propertyManagementId);

    const oldestPendingByPm = new Map(
      oldestPendingRows.map((r) => [
        r.propertyManagementId,
        r.oldestPendingAt ?? null,
      ]),
    );

    const [lastSuccessAdmin, lastSuccessSync, lastSuccessExtract] =
      await Promise.all([
        lastSuccessfulRunCreatedAt("admin-scrape"),
        lastSuccessfulRunCreatedAt("update-flats"),
        lastSuccessfulRunCreatedAt("extract-flats"),
      ]);

    const perPropertyManagement = activeSlugs.map((slug) => {
      const counts = pmMap.get(slug) ?? {
        pending: 0,
        failed: 0,
        completed: 0,
      };
      return {
        slug,
        ...counts,
        oldestPendingAt: oldestPendingByPm.get(slug) ?? null,
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
      activity: {
        lastSuccessAdmin,
        lastSuccessSync,
        lastSuccessExtract,
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
        mode: z.enum(["full", "sync_only", "extract_only"]).default("full"),
      }),
    )
    .mutation(async ({ input }) => {
      const started = Date.now();
      const mode = input.mode;
      const activeRows = await db
        .select({ slug: propertyManagement.slug })
        .from(propertyManagement)
        .where(eq(propertyManagement.active, true));

      const activeSet = new Set(activeRows.map((r) => r.slug));
      const scoped = Boolean(input.slugs?.length);

      let targetSlugs: string[];
      if (scoped) {
        targetSlugs =
          input.slugs?.filter((s) => activeSet.has(s) && isConfiguredPm(s)) ??
          [];
      } else {
        targetSlugs = activeRows
          .map((r) => r.slug)
          .filter((s) => isConfiguredPm(s));
      }

      if (targetSlugs.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: scoped
            ? "Keine passende Verwaltung für diese Aktion (inaktiv oder nicht konfiguriert)."
            : "Keine konfigurierte aktive Verwaltung.",
        });
      }

      const now = Date.now();
      if (scoped) {
        for (const slug of targetSlugs) {
          const last = adminScrapeLastAt.get(slug);
          if (last !== undefined && now - last < ADMIN_SCRAPE_COOLDOWN_MS) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message:
                "Zu schnell hintereinander — bitte ~30 Sekunden warten (Cooldown pro Verwaltung).",
            });
          }
        }
        for (const slug of targetSlugs) adminScrapeLastAt.set(slug, now);
      } else {
        const last = adminScrapeLastAt.get(adminScrapeCooldownGlobal);
        if (last !== undefined && now - last < ADMIN_SCRAPE_COOLDOWN_MS) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Zu schnell hintereinander — bitte ~30 Sekunden warten (Cooldown für Alle-Verwaltungen-Lauf).",
          });
        }
        adminScrapeLastAt.set(adminScrapeCooldownGlobal, now);
      }

      if (mode === "full") {
        await pruneFlatsNotSeenForDays(7);
      }

      const syncResults: Array<{
        slug: string;
        success: boolean;
        stats: SyncListingsStats;
        error?: string;
      }> = [];

      if (mode === "full" || mode === "sync_only") {
        for (const slug of targetSlugs) {
          const r = await syncListingsForPropertyManagement(slug);
          syncResults.push({
            slug,
            success: r.success,
            stats: r.stats,
            error: r.error,
          });
        }
      }

      let extractionStats: ProcessFlatUrlJobsStats;
      if (mode === "full" || mode === "extract_only") {
        const { stats } = await processFlatUrlJobs({
          limit: env.ADMIN_SCRAPER_EXTRACT_BATCH,
          propertyManagementIds: scoped ? targetSlugs : undefined,
          sleepBetweenJobs: false,
        });
        extractionStats = stats;
      } else {
        extractionStats = {
          flatsExtracted: 0,
          flatsFailed: 0,
          flatsPending: await countPendingJobs(
            scoped ? targetSlugs : undefined,
          ),
        };
      }

      const pendingRemaining = extractionStats.flatsPending;

      const payload = {
        mode,
        syncResults,
        extractionStats,
        pendingRemaining,
      };

      const syncOk =
        mode === "extract_only" || syncResults.every((s) => s.success);
      const extractOk =
        mode === "sync_only" || extractionStats.flatsFailed === 0;
      const runOk = syncOk && extractOk;

      await logScraperRun({
        kind: "admin-scrape",
        propertyManagementId: null,
        success: runOk,
        stats: payload,
        errorMessage: runOk
          ? null
          : [
              ...(mode !== "extract_only"
                ? syncResults
                    .filter((s) => !s.success)
                    .map((s) => `${s.slug}: ${s.error ?? "unknown"}`)
                : []),
              ...(mode !== "sync_only" && !extractOk
                ? [`extract: ${extractionStats.flatsFailed} fehlgeschlagen`]
                : []),
            ].join("; ") || null,
        durationMs: Date.now() - started,
        trigger: "admin",
      });

      return payload;
    }),

  /**
   * Re-queue a failed flatUrlJob: pending + clear lastError. attempts unchanged (audit).
   */
  retryFlatUrlJob: protectedProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const updated = await db
        .update(flatUrlJob)
        .set({ status: "pending", lastError: null })
        .where(
          and(eq(flatUrlJob.url, input.url), eq(flatUrlJob.status, "failed")),
        )
        .returning({ url: flatUrlJob.url });

      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Kein fehlgeschlagener Job mit dieser URL — evtl. bereits verarbeitet.",
        });
      }
      return { url: updated[0]!.url };
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
