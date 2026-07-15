import { GrammyError, InputFile } from "grammy";
import { type Channel, type NotifiableFlat } from "~/server/lib/notifiers/types";
import { getBot, isTelegramConfigured } from "./bot";
import { loadFlatImage, renderNotification } from "./render";

/** Telegram API error codes/descriptions that mean the target is gone for good. */
function isBlockedError(err: GrammyError): boolean {
  if (err.error_code === 403) return true; // bot blocked / kicked
  const d = err.description.toLowerCase();
  return (
    d.includes("chat not found") ||
    d.includes("user is deactivated") ||
    d.includes("bot was blocked") ||
    d.includes("group chat was upgraded")
  );
}

/**
 * Delivers listing notifications to a Telegram chat (`target` = chat id). Sends
 * the stored image as a photo with an HTML caption; falls back to a text message
 * when the listing has no image. Permanent failures (blocked/gone) report
 * `blocked: true` so the sweep deactivates the subscriber.
 */
export const telegramChannel: Channel = {
  async send(target, flat: NotifiableFlat) {
    if (!isTelegramConfigured) {
      console.warn("[notify] telegram channel used but TELEGRAM_BOT_TOKEN is unset");
      return { ok: false, blocked: false };
    }

    const api = getBot().api;
    const { caption, keyboard } = renderNotification(flat);

    try {
      const image = await loadFlatImage(flat.id);
      if (image) {
        await api.sendPhoto(target, new InputFile(new Uint8Array(image), `${flat.id}.jpg`), {
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } else {
        await api.sendMessage(target, caption, {
          parse_mode: "HTML",
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });
      }
      return { ok: true };
    } catch (err) {
      if (err instanceof GrammyError) {
        const blocked = isBlockedError(err);
        console.warn(
          `[notify] telegram send failed (${target}, flat ${flat.id}): ` +
            `${err.error_code} ${err.description}${blocked ? " [deactivating]" : ""}`,
        );
        return { ok: false, blocked };
      }
      console.error(`[notify] telegram send error (${target}, flat ${flat.id}):`, err);
      return { ok: false, blocked: false };
    }
  },
};
