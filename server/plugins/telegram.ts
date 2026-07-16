import { env } from "~/env";
import {
  getBot,
  isTelegramConfigured,
} from "~/server/lib/notifiers/telegram/bot";

async function startLongPolling(
  bot: ReturnType<typeof getBot>,
  reason: string,
) {
  // Detach webhook first so getUpdates isn't rejected; don't await start()
  // (it resolves only when the bot stops).
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  void bot.start({
    onStart: (me) =>
      console.log(`[telegram] long-polling as @${me.username} (${reason})`),
  });
}

/**
 * Boots the Telegram transport. Dev / non-HTTPS DEPLOYMENT_URL → long-poll.
 * Production with HTTPS → webhook at `/api/telegram/webhook`. No-op when
 * `TELEGRAM_BOT_TOKEN` is unset.
 */
export default defineNitroPlugin(async () => {
  if (!isTelegramConfigured) return;

  const bot = getBot();
  const deploymentUrl = env.DEPLOYMENT_URL;
  const canUseWebhook = deploymentUrl.startsWith("https://");

  if (import.meta.dev || !canUseWebhook) {
    await startLongPolling(
      bot,
      import.meta.dev ? "dev" : `DEPLOYMENT_URL is not HTTPS: ${deploymentUrl}`,
    );
    return;
  }

  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET is required in production when TELEGRAM_BOT_TOKEN is set",
    );
  }

  const url = `${deploymentUrl}/api/telegram/webhook`;
  await bot.api.setWebhook(url, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    drop_pending_updates: true,
  });
  console.log(`[telegram] webhook set to ${url}`);
});
