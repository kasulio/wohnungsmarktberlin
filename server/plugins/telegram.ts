import { env } from "~/env";
import { createLogger } from "~/lib/logger";
import {
  getBot,
  isTelegramConfigured,
} from "~/server/lib/notifiers/telegram/bot";
import { sendOpsAlert } from "~/server/lib/ops-alerts";

const log = createLogger("telegram");

async function startLongPolling(
  bot: ReturnType<typeof getBot>,
  reason: string,
) {
  // Detach webhook first so getUpdates isn't rejected; don't await start()
  // (it resolves only when the bot stops).
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  void bot
    .start({
      onStart: (me) =>
        log.info("long-polling started", { username: me.username, reason }),
    })
    .catch((error) => {
      log.error("long-polling stopped with error", { error });
    });
}

/**
 * Boots the Telegram transport. Dev / non-HTTPS DEPLOYMENT_URL → long-poll.
 * Production with HTTPS → webhook at `/api/telegram/webhook`. No-op when
 * `TELEGRAM_BOT_TOKEN` is unset.
 */
export default defineNitroPlugin(async (nitroApp) => {
  if (!isTelegramConfigured) return;

  const bot = getBot();
  bot.catch((err) => {
    log.error("bot update handler failed", {
      updateId: err.ctx.update.update_id,
      error: err.error,
    });
    void sendOpsAlert({
      key: "telegram-bot-error",
      title: "Telegram bot handler threw an error",
      details:
        err.error instanceof Error ? err.error.message : String(err.error),
    });
  });

  const deploymentUrl = env.DEPLOYMENT_URL;
  const canUseWebhook = deploymentUrl.startsWith("https://");
  let longPolling = false;

  if (import.meta.dev || !canUseWebhook) {
    try {
      await startLongPolling(
        bot,
        import.meta.dev
          ? "dev"
          : `DEPLOYMENT_URL is not HTTPS: ${deploymentUrl}`,
      );
      longPolling = true;
    } catch (error) {
      log.error("failed to start telegram long-polling", { error });
    }
  } else {
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      throw new Error(
        "TELEGRAM_WEBHOOK_SECRET is required in production when TELEGRAM_BOT_TOKEN is set",
      );
    }

    const url = `${deploymentUrl}/api/telegram/webhook`;
    try {
      await bot.api.setWebhook(url, {
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        drop_pending_updates: true,
      });
      log.info("webhook registered", { url });
    } catch (error) {
      // Don't take down the web server if Telegram is momentarily unreachable at boot.
      log.error("failed to register telegram webhook", { url, error });
      void sendOpsAlert({
        key: "telegram-webhook-boot",
        title: "Failed to register Telegram webhook on boot",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  nitroApp.hooks.hook("close", () => {
    if (!longPolling) return;
    log.info("stopping long-polling");
    bot.stop();
  });
});
