import { Effect } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import {
  countPendingJobs,
  type ExtractStats,
  extractFlats,
} from "./extract-flats";
import { pruneStaleFlats } from "./prune-stale-flats";
import { loggedRun } from "./run-log";
import { type SyncReport, syncListingsReport } from "./sync-listings";

export type AdminScrapeMode = "full" | "sync_only" | "extract_only";

export type AdminScrapeOptions = {
  mode: AdminScrapeMode;
  targets: PropertyManagementId[];
  /** Unscoped runs extract the oldest pending jobs of any company. */
  scoped: boolean;
  extractBatch: number;
};

export type AdminScrapeReport = {
  mode: AdminScrapeMode;
  syncResults: (SyncReport & { slug: PropertyManagementId })[];
  extractionStats: ExtractStats;
  pendingRemaining: number;
};

const failures = (report: AdminScrapeReport) => [
  ...report.syncResults
    .filter((s) => !s.success)
    .map((s) => `${s.slug}: ${s.error ?? "unknown"}`),
  ...(report.extractionStats.flatsFailed > 0
    ? [`extract: ${report.extractionStats.flatsFailed} fehlgeschlagen`]
    : []),
];

/** An admin-triggered scrape: optional prune, sync, then one interactive extract batch. */
export const adminScrape = (options: AdminScrapeOptions) =>
  loggedRun(
    {
      kind: "admin-scrape",
      trigger: "admin",
      propertyManagementId:
        options.scoped && options.targets.length === 1
          ? options.targets[0]
          : null,
    },
    Effect.gen(function* () {
      const { mode, targets } = options;
      const companies = options.scoped ? targets : undefined;

      if (mode === "full") yield* pruneStaleFlats(7);

      const syncResults =
        mode === "extract_only"
          ? []
          : yield* Effect.forEach(targets, (slug) =>
              syncListingsReport(slug).pipe(
                Effect.map((report) => ({ slug, ...report })),
              ),
            );

      const extractionStats =
        mode === "sync_only"
          ? {
              flatsExtracted: 0,
              flatsFailed: 0,
              flatsPending: yield* countPendingJobs(companies),
            }
          : yield* extractFlats({
              limit: options.extractBatch,
              propertyManagementIds: companies,
              pace: "interactive",
            });

      const report: AdminScrapeReport = {
        mode,
        syncResults,
        extractionStats,
        pendingRemaining: extractionStats.flatsPending,
      };
      const errors = failures(report);
      return {
        success: errors.length === 0,
        stats: report,
        errorMessage: errors.join("; ") || null,
      };
    }),
  ).pipe(Effect.map((outcome) => outcome.stats));
