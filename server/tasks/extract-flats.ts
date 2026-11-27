import { Effect } from "effect";
import { createLogger } from "~/lib/logger";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import {
  markTaskFinished,
  markTaskSkipped,
  markTaskStarted,
} from "~/server/lib/pipeline-health";
import { extractFlats } from "~/server/lib/scraper/extract-flats";
import { runScraper } from "~/server/lib/scraper/live";
import { loggedRun } from "~/server/lib/scraper/run-log";
import { createSkipIfRunning } from "~/server/lib/single-flight";

const log = createLogger("task:extract-flats");
const guard = createSkipIfRunning<{ success: boolean; stats: unknown }>();

export default defineTask({
  meta: {
    name: "extract-flats",
    description: "Extract flats from the oldest pending listing URL jobs",
  },
  run: async () => {
    const runResult = await guard.run(async () => {
      const started = Date.now();
      const runId = Bun.randomUUIDv7();
      const runLog = log.child({ runId });

      markTaskStarted("extract-flats", started);

      try {
        const result = await runScraper(
          loggedRun(
            { kind: "extract-flats", trigger: "scheduled" },
            extractFlats({ limit: 10, pace: "background" }).pipe(
              Effect.map((stats) => ({
                success: stats.flatsFailed === 0,
                stats,
                errorMessage:
                  stats.flatsFailed > 0
                    ? `${stats.flatsFailed} Extraktion(en) fehlgeschlagen`
                    : null,
              })),
            ),
          ),
        );

        const durationMs = Date.now() - started;
        const { consecutiveFailures } = markTaskFinished("extract-flats", {
          success: result.success,
          durationMs,
          error: result.errorMessage,
          stats: result.stats,
        });

        if (result.stats.flatsExtracted > 0 || result.stats.flatsFailed > 0) {
          runLog.info("extract batch completed", {
            durationMs,
            ...result.stats,
          });
        } else {
          runLog.debug("extract batch idle", { durationMs, ...result.stats });
        }

        if (consecutiveFailures >= 3) {
          void sendOpsAlert({
            key: "extract-failures",
            title: `extract-flats had failures in ${consecutiveFailures} consecutive batches`,
            details: `extracted=${result.stats.flatsExtracted} failed=${result.stats.flatsFailed} pending=${result.stats.flatsPending}`,
          });
        }

        return result;
      } catch (error) {
        const durationMs = Date.now() - started;
        const message = error instanceof Error ? error.message : String(error);
        markTaskFinished("extract-flats", {
          success: false,
          durationMs,
          error: message,
        });
        runLog.error("extract batch crashed", { durationMs, error });
        void sendOpsAlert({
          key: "task-crash:extract-flats",
          title: "extract-flats task crashed",
          details: message,
        });
        throw error;
      }
    });

    if (runResult.skipped) {
      markTaskSkipped("extract-flats");
      log.warn("skipping tick: previous run still in flight");
      return { result: { skipped: true, success: true, stats: null } };
    }

    return { result: { skipped: false, ...runResult.value } };
  },
});
