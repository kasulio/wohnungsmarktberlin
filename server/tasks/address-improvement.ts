import { createLogger } from "~/lib/logger";
import { runAddressImprovement } from "~/server/lib/address-improvement";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import {
  markTaskFinished,
  markTaskStarted,
} from "~/server/lib/pipeline-health";
import { recordScraperRun } from "~/server/lib/scraper/run-log";

const log = createLogger("task:address-improvement");

export default defineTask({
  meta: {
    name: "address-improvement",
    description: "Improve the addresses of the flats",
  },
  run: async () => {
    const started = Date.now();
    markTaskStarted("address-improvement", started);

    try {
      const stats = await runAddressImprovement();
      const durationMs = Date.now() - started;
      const success = stats.addressesTransientFailed === 0;
      const errorMessage =
        stats.addressesTransientFailed > 0
          ? `${stats.addressesTransientFailed} vorübergehende Photon-Fehler`
          : null;

      markTaskFinished("address-improvement", {
        success,
        durationMs,
        error: errorMessage,
        stats,
      });

      const didWork =
        stats.addressesImproved > 0 ||
        stats.addressesFailed > 0 ||
        stats.addressesTransientFailed > 0;
      if (didWork) {
        await recordScraperRun({
          kind: "address-improvement",
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
      markTaskFinished("address-improvement", {
        success: false,
        durationMs,
        error: message,
      });
      log.error("address-improvement task failed", { durationMs, error });
      await recordScraperRun({
        kind: "address-improvement",
        trigger: "scheduled",
        success: false,
        stats: {
          addressesImproved: 0,
          addressesFailed: 0,
          addressesTransientFailed: 0,
          addressesPending: 0,
        },
        errorMessage: message,
        durationMs,
      }).catch(() => {});
      void sendOpsAlert({
        key: "task-crash:address-improvement",
        title: "address-improvement task crashed",
        details: message,
      });
      throw error;
    }
  },
});
