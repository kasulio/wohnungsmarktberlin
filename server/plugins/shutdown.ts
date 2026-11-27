import { createLogger } from "~/lib/logger";
import { closeDb } from "~/server/db/client";

const log = createLogger("shutdown");

/**
 * Nitro's `bun` preset does not wire SIGTERM/SIGINT to the runtime `close`
 * hook (unlike `node-server`). Coolify/Docker stop with SIGTERM then SIGKILL
 * after the grace period (~30s) — handle the signal ourselves so cleanup runs
 * and the process exits before kill.
 */
export default defineNitroPlugin((nitroApp) => {
  if (process.env.NITRO_SHUTDOWN_DISABLED === "true") return;

  const timeoutMs =
    Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 25_000;
  const signals = (process.env.NITRO_SHUTDOWN_SIGNALS || "SIGTERM SIGINT")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

  let shuttingDown = false;

  nitroApp.hooks.hook("close", () => {
    try {
      closeDb();
      log.info("sqlite closed");
    } catch (error) {
      log.error("sqlite close failed", { error });
    }
  });

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info("received shutdown signal", { signal });

    const forceTimer = setTimeout(() => {
      log.warn("shutdown timeout, forcing exit", { timeoutMs });
      process.exit(1);
    }, timeoutMs);

    try {
      await nitroApp.hooks.callHook("close");
    } catch (error) {
      log.error("close hook error", { error });
    } finally {
      clearTimeout(forceTimer);
      log.info("exiting");
      process.exit(0);
    }
  };

  for (const signal of signals) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
});
