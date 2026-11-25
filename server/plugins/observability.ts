import { createLogger } from "~/lib/logger";
import { sendOpsAlert } from "~/server/lib/ops-alerts";

const log = createLogger("nitro");

/**
 * Logs unhandled Nitro server errors in structured form and alerts ops on 5xx.
 * Expected client errors (4xx like 404/401) are logged at warn/debug only.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("error", (error, { event }) => {
    const rawStatus =
      "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    const statusCode = typeof rawStatus === "number" ? rawStatus : 500;
    const method = event?.method;
    const path = event?.path;

    if (statusCode >= 500) {
      log.error("unhandled server error", {
        method,
        path,
        statusCode,
        error,
      });
      void sendOpsAlert({
        key: `http-500:${path ?? "unknown"}`,
        title: `HTTP ${statusCode} on ${method ?? "?"} ${path ?? "unknown"}`,
        details: error instanceof Error ? error.message : String(error),
      });
    } else if (statusCode !== 404) {
      log.warn("server request error", {
        method,
        path,
        statusCode,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
});
