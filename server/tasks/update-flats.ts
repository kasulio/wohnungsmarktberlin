import { Effect } from "effect";
import { propertyManagements } from "~/data/propertyManagements";
import { createLogger } from "~/lib/logger";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import {
  markTaskFinished,
  markTaskSkipped,
  markTaskStarted,
  recordPmSyncResult,
} from "~/server/lib/pipeline-health";
import { runScraper } from "~/server/lib/scraper/live";
import { pruneStaleFlats } from "~/server/lib/scraper/prune-stale-flats";
import { loggedRun } from "~/server/lib/scraper/run-log";
import { syncListingsReport } from "~/server/lib/scraper/sync-listings";
import { createSkipIfRunning } from "~/server/lib/single-flight";
import { typedObjectKeys } from "~/utils/typeHelper";

const log = createLogger("task:update-flats");
const guard = createSkipIfRunning<{ success: boolean; stats: unknown }>();
let lastIndex = 0;

export default defineTask({
  meta: {
    name: "update-flats",
    description:
      "Synchronize flats from property management websites by extracting URLs, marking deleted flats, and creating jobs for new listings",
  },
  run: async () => {
    const runResult = await guard.run(async () => {
      const started = Date.now();
      const runId = Bun.randomUUIDv7();
      const ids = typedObjectKeys(propertyManagements);
      const propertyManagementId = ids[lastIndex++ % ids.length]!;
      const runLog = log.child({ runId, pm: propertyManagementId });

      markTaskStarted("update-flats", started);
      runLog.debug("starting sync");

      try {
        const outcome = await runScraper(
          loggedRun(
            {
              kind: "update-flats",
              trigger: "scheduled",
              propertyManagementId,
            },
            Effect.gen(function* () {
              yield* pruneStaleFlats(7);
              const report = yield* syncListingsReport(propertyManagementId);
              return {
                success: report.success,
                stats: report.stats,
                errorMessage: report.error,
              };
            }),
          ),
        );

        const durationMs = Date.now() - started;
        markTaskFinished("update-flats", {
          success: outcome.success,
          durationMs,
          error: outcome.errorMessage,
          stats: { pm: propertyManagementId, ...outcome.stats },
        });

        const { consecutiveFailures } = recordPmSyncResult(
          propertyManagementId,
          outcome.success,
        );

        if (outcome.success) {
          runLog.info("sync completed", { durationMs, ...outcome.stats });
        } else {
          runLog.warn("sync failed", {
            durationMs,
            consecutiveFailures,
            error: outcome.errorMessage,
          });
          const isAnomaly =
            outcome.errorMessage?.startsWith("Refusing to delete") ?? false;
          if (isAnomaly || consecutiveFailures >= 3) {
            void sendOpsAlert({
              key: `sync-fail:${propertyManagementId}`,
              title: isAnomaly
                ? `Scraper ${propertyManagementId} returned 0 URLs (delete aborted)`
                : `Scraper ${propertyManagementId} failed ${consecutiveFailures} syncs in a row`,
              details: outcome.errorMessage ?? undefined,
            });
          }
        }

        return { success: outcome.success, stats: outcome.stats };
      } catch (error) {
        const durationMs = Date.now() - started;
        const message = error instanceof Error ? error.message : String(error);
        markTaskFinished("update-flats", {
          success: false,
          durationMs,
          error: message,
        });
        runLog.error("sync crashed", { durationMs, error });
        void sendOpsAlert({
          key: `task-crash:update-flats:${propertyManagementId}`,
          title: `update-flats crashed for ${propertyManagementId}`,
          details: message,
        });
        throw error;
      }
    });

    if (runResult.skipped) {
      markTaskSkipped("update-flats");
      log.warn("skipping tick: previous run still in flight");
      return { result: { skipped: true, success: true, stats: null } };
    }

    return { result: { skipped: false, ...runResult.value } };
  },
});
