import { closeDb } from "~/server/db/client";

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
      console.log("[shutdown] sqlite closed");
    } catch (error) {
      console.error("[shutdown] sqlite close failed", error);
    }
  });

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] received ${signal}`);

    const forceTimer = setTimeout(() => {
      console.warn("[shutdown] timeout, force exit");
      process.exit(1);
    }, timeoutMs);

    try {
      await nitroApp.hooks.callHook("close");
    } catch (error) {
      console.error("[shutdown] close hook error", error);
    } finally {
      clearTimeout(forceTimer);
      console.log("[shutdown] exit");
      process.exit(0);
    }
  };

  for (const signal of signals) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
});
