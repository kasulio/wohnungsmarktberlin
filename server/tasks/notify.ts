import { createLogger } from "~/lib/logger";
import { runNotifySweep } from "~/server/lib/notify-sweep";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import {
  markTaskFinished,
  markTaskStarted,
} from "~/server/lib/pipeline-health";
import { recordScraperRun } from "~/server/lib/scraper/run-log";

const log = createLogger("task:notify");

export default defineTask({
  meta: {
    name: "notify",
    description:
      "Notify subscribers (log/telegram/email) of newly-published flats",
  },
  run: async () => {
    const started = Date.now();
    markTaskStarted("notify", started);

    try {
      const stats = await runNotifySweep();
      const durationMs = Date.now() - started;
      const success = stats.failed === 0;
      const errorMessage =
        stats.failed > 0 ? `${stats.failed} Zustellfehler` : null;

      markTaskFinished("notify", {
        success,
        durationMs,
        error: errorMessage,
        stats,
      });

      const didWork =
        stats.stamped > 0 ||
        stats.sent > 0 ||
        stats.failed > 0 ||
        stats.deactivated > 0;
      if (didWork) {
        await recordScraperRun({
          kind: "notify",
          trigger: "scheduled",
          success,
          stats,
          errorMessage,
          durationMs,
        });
      }

      return { result: { success, stats } };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      markTaskFinished("notify", {
        success: false,
        durationMs,
        error: message,
      });
      log.error("notify task failed", { durationMs, error });
      await recordScraperRun({
        kind: "notify",
        trigger: "scheduled",
        success: false,
        stats: {
          stamped: 0,
          subscribers: 0,
          candidates: 0,
          sent: 0,
          failed: 0,
          deactivated: 0,
        },
        errorMessage: message,
        durationMs,
      }).catch(() => {});
      void sendOpsAlert({
        key: "task-crash:notify",
        title: "notify task crashed",
        details: message,
      });
      throw error;
    }
  },
});
