import { env } from "~/env";
import { createLogger } from "~/lib/logger";
import {
  getBot,
  isTelegramConfigured,
} from "~/server/lib/notifiers/telegram/bot";
import { escapeHtml } from "~/server/lib/notifiers/telegram/html";

const log = createLogger("ops-alert");

const DEFAULT_COOLDOWN_MS = 60 * 60_000;
const lastSentByKey = new Map<string, number>();

export type OpsAlertParams = {
  /** Deduplication key (e.g. `sync-fail:degewo`, `photon-errors`, `http-500:/api/...`). */
  key: string;
  /** Short headline describing the problem. */
  title: string;
  /** Extra diagnostic lines or context. */
  details?: string;
  /** Minimum interval before the same `key` alerts Telegram again. Default 60m. */
  cooldownMs?: number;
  /** Injectable clock for tests. */
  now?: number;
  /** Injectable sender for tests. */
  send?: (chatId: string, html: string) => Promise<void>;
  /** Override chatId for tests. */
  chatId?: string;
};

async function sendViaTelegram(chatId: string, html: string) {
  await getBot().api.sendMessage(chatId, html, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Records a high-severity operational issue in structured logs and, if
 * `ADMIN_TELEGRAM_CHAT_ID` + `TELEGRAM_BOT_TOKEN` are configured, pushes a
 * deduplicated alert to the admin Telegram chat. Never throws.
 */
export async function sendOpsAlert(params: OpsAlertParams): Promise<boolean> {
  const now = params.now ?? Date.now();
  const cooldownMs = params.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  log.error(params.title, {
    alertKey: params.key,
    details: params.details,
  });

  const last = lastSentByKey.get(params.key);
  if (last !== undefined && now - last < cooldownMs) {
    return false;
  }

  const chatId = params.chatId ?? env.ADMIN_TELEGRAM_CHAT_ID;
  if (!chatId || (!params.send && !isTelegramConfigured)) {
    return false;
  }

  lastSentByKey.set(params.key, now);

  const lines = [
    `🚨 <b>WohnungsMarktBerlin Alert</b>`,
    escapeHtml(params.title),
  ];
  if (params.details) {
    lines.push(`<pre>${escapeHtml(params.details.slice(0, 1500))}</pre>`);
  }
  const html = lines.join("\n\n");

  try {
    const sender = params.send ?? sendViaTelegram;
    await sender(chatId, html);
    return true;
  } catch (error) {
    log.warn("failed to deliver ops alert via telegram", {
      alertKey: params.key,
      error,
    });
    return false;
  }
}

export function resetOpsAlertCooldownsForTests() {
  lastSentByKey.clear();
}
