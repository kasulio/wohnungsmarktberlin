import { env } from "~/env";
import {
  getBot,
  isTelegramConfigured,
} from "~/server/lib/notifiers/telegram/bot";

/**
 * Boots the Telegram transport. In dev we long-poll (no public URL needed); in
 * production we register a webhook pointing at `/api/telegram/webhook`. A no-op
 * when `TELEGRAM_BOT_TOKEN` is unset, so the app runs fine without telegram.
 */
export default defineNitroPlugin(async () => {
  if (!isTelegramConfigured) return;

  const bot = getBot();

  if (import.meta.dev) {
    // Long-poll locally. Detach webhook first so getUpdates isn't rejected, and
    // don't await start() (it resolves only when the bot stops).
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    void bot.start({
      onStart: (me) =>
        console.log(`[telegram] long-polling as @${me.username}`),
    });
    return;
  }

  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET is required in production when TELEGRAM_BOT_TOKEN is set",
    );
  }

  const url = `${env.DEPLOYMENT_URL}/api/telegram/webhook`;
  await bot.api.setWebhook(url, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    drop_pending_updates: true,
  });
  console.log(`[telegram] webhook set to ${url}`);
});
