import { Bot } from "grammy";
import { env } from "~/env";
import { registerCommands } from "./commands";

/** True when a bot token is configured; the telegram channel is otherwise inert. */
export const isTelegramConfigured = !!env.TELEGRAM_BOT_TOKEN;

let bot: Bot | null = null;

/**
 * Lazily create the configured grammy bot singleton. Throws if no token is set —
 * callers that may run without telegram configured should guard on
 * `isTelegramConfigured` first.
 */
export function getBot(): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!bot) {
    bot = new Bot(env.TELEGRAM_BOT_TOKEN);
    registerCommands(bot);
  }
  return bot;
}
