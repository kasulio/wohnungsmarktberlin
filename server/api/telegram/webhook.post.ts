import { type Update } from "grammy/types";
import { env } from "~/env";
import {
  getBot,
  isTelegramConfigured,
} from "~/server/lib/notifiers/telegram/bot";

/**
 * Telegram webhook receiver (production transport). Verifies the secret token
 * Telegram echoes back in the `X-Telegram-Bot-Api-Secret-Token` header, then
 * hands the update to the bot. In dev we long-poll instead (see the plugin).
 */
export default defineEventHandler(async (event) => {
  if (!isTelegramConfigured) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: "Telegram webhook secret not configured",
    });
  }

  const provided = getHeader(event, "x-telegram-bot-api-secret-token");
  if (provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const update = await readBody<Update>(event);
  const bot = getBot();
  if (!bot.isInited()) await bot.init();
  await bot.handleUpdate(update);
  return { ok: true };
});
