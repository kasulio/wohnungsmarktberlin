import { createLogger } from "~/lib/logger";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import {
  markTaskFinished,
  markTaskSkipped,
  markTaskStarted,
} from "~/server/lib/pipeline-health";
import { recordScraperRun } from "~/server/lib/scraper/run-log";
import { createSkipIfRunning } from "~/server/lib/single-flight";
import { createCaller } from "../trpc/routers";
import { updateMapPreview } from "../updateMapPreview";

const log = createLogger("task:update-map-preview");
const guard = createSkipIfRunning<{ regenerated: boolean }>();
let previousMapPreviewHash: string | null = null;

export default defineTask({
  meta: {
    name: "update-map-preview",
    description: "Update the map preview",
  },
  run: async () => {
    const runResult = await guard.run(async () => {
      const started = Date.now();
      markTaskStarted("update-map-preview", started);

      try {
        const caller = createCaller({
          user: "admin",
          ip: "task",
        });

        const mapPreviewHash = await caller.flat.getMapPreviewHash();

        if (previousMapPreviewHash === null) {
          previousMapPreviewHash = mapPreviewHash;
        }

        let regenerated = false;
        if (
          mapPreviewHash !== previousMapPreviewHash &&
          process.env.NODE_ENV !== "development"
        ) {
          log.info("hash changed, regenerating map preview");
          await updateMapPreview();
          previousMapPreviewHash = mapPreviewHash;
          regenerated = true;
        }

        const durationMs = Date.now() - started;
        markTaskFinished("update-map-preview", {
          success: true,
          durationMs,
          stats: { regenerated },
        });

        if (regenerated) {
          await recordScraperRun({
            kind: "update-map-preview",
            trigger: "scheduled",
            success: true,
            stats: { regenerated: true },
            durationMs,
          });
        }

        return { regenerated };
      } catch (error) {
        const durationMs = Date.now() - started;
        const message = error instanceof Error ? error.message : String(error);
        markTaskFinished("update-map-preview", {
          success: false,
          durationMs,
          error: message,
        });
        log.error("map preview update failed", { durationMs, error });
        await recordScraperRun({
          kind: "update-map-preview",
          trigger: "scheduled",
          success: false,
          stats: { regenerated: false },
          errorMessage: message,
          durationMs,
        }).catch(() => {});
        void sendOpsAlert({
          key: "task-crash:update-map-preview",
          title: "update-map-preview failed",
          details: message,
        });
        throw error;
      }
    });

    if (runResult.skipped) {
      markTaskSkipped("update-map-preview");
      log.warn("skipping tick: previous run still in flight");
      return { result: { skipped: true, regenerated: false } };
    }

    return { result: { skipped: false, ...runResult.value } };
  },
});
