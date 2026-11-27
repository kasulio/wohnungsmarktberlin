import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, isNull, max, min, sql } from "drizzle-orm";
import { propertyManagements } from "~/data/propertyManagements";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { env } from "~/env";
import { publishableFlatFilter } from "~/lib/flat-publishability";
import { db } from "~/server/db/client";
import {
  flat,
  flatUrlJob,
  propertyManagement,
  scraperRun,
} from "~/server/db/schema";
import { runAddressImprovement } from "~/server/lib/address-improvement";
import { evaluateTaskHeartbeats } from "~/server/lib/pipeline-health";
import { adminScrape } from "~/server/lib/scraper/admin-scrape";
import { describeRunStats } from "~/server/lib/scraper/describe-run-stats";
import { runScraper } from "~/server/lib/scraper/live";
import { publicProcedure, protectedProcedure, router } from "../trpc";

/** In-memory only; multi-instance deploy needs shared lock (see follow-up plan). */
const ADMIN_SCRAPE_COOLDOWN_MS = 30_000;
const adminScrapeCooldownGlobal = "__admin_scrape_all__";
const adminScrapeLastAt = new Map<string, number>();

const isConfiguredPm = (slug: string): slug is PropertyManagementId =>
  Object.hasOwn(propertyManagements, slug);

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
        activeFlatCount: sql<number>`sum(case when ${publishableFlatFilter()} then 1 else 0 end)`,
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
      .then((rows) => rows.map((r) => r.slug).filter(isConfiguredPm));

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

    const lastRunRows = await db
      .select({
        propertyManagementId: scraperRun.propertyManagementId,
        lastRunAt: max(scraperRun.createdAt),
      })
      .from(scraperRun)
      .where(eq(scraperRun.success, true))
      .groupBy(scraperRun.propertyManagementId);
    const lastRunByPm = new Map(
      lastRunRows.map((r) => [r.propertyManagementId, r.lastRunAt ?? null]),
    );

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
        lastRunAt: lastRunByPm.get(slug) ?? null,
        failedSamples: failedSamplesByPm.get(slug) ?? [],
      };
    });

    const geocodeRows = await db
      .select({
        status: flat.addressImprovement,
        cnt: count(),
      })
      .from(flat)
      .where(and(isNull(flat.deleted), eq(flat.ignored, false)))
      .groupBy(flat.addressImprovement);

    const geocoding = { pending: 0, failed: 0 };
    for (const row of geocodeRows) {
      if (row.status === "pending") geocoding.pending = row.cnt;
      else if (row.status === "failed") geocoding.failed = row.cnt;
    }

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
        errorMessage: scraperRun.errorMessage,
      })
      .from(scraperRun)
      .orderBy(desc(scraperRun.createdAt))
      .limit(20);

    const pipelineHealth = evaluateTaskHeartbeats({
      scheduledTasksEnabled: env.SCHEDULED_TASKS !== "off",
    });

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
      geocoding,
      pipelineHealth,
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
        errorMessage: r.errorMessage,
        statsSummary: describeRunStats(r.statsJson),
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
      const activeRows = await db
        .select({ slug: propertyManagement.slug })
        .from(propertyManagement)
        .where(eq(propertyManagement.active, true));

      const activeSet = new Set(activeRows.map((r) => r.slug));
      const scoped = Boolean(input.slugs?.length);

      let targetSlugs: PropertyManagementId[];
      if (scoped) {
        targetSlugs =
          input.slugs?.filter(
            (s): s is PropertyManagementId =>
              activeSet.has(s) && isConfiguredPm(s),
          ) ?? [];
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

      return runScraper(
        adminScrape({
          mode: input.mode,
          targets: targetSlugs,
          scoped,
          extractBatch: env.ADMIN_SCRAPER_EXTRACT_BATCH,
        }),
      );
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

  /** Re-queue active, non-ignored flats whose geocoding failed and kick a batch. */
  retryFailedGeocodes: protectedProcedure.mutation(async () => {
    const reset = await db
      .update(flat)
      .set({ addressImprovement: "pending" })
      .where(
        and(
          isNull(flat.deleted),
          eq(flat.ignored, false),
          isNull(flat.addressId),
          eq(flat.addressImprovement, "failed"),
        ),
      )
      .returning({ id: flat.id });

    if (reset.length > 0) {
      void runAddressImprovement().catch(() => {});
    }

    return { resetCount: reset.length };
  }),
});
