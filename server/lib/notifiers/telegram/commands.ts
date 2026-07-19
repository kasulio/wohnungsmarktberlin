import { type Bot, InlineKeyboard } from "grammy";
import { and, eq } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db/client";
import { notificationSubscriber } from "~/server/db/schema";
import { describeFlatFilter } from "~/lib/describe-flat-filter";
import { consumeLinkToken } from "./link-token";
import { escapeHtml } from "./html";

/** Link back to the website's listing overview, where filters are configured. */
function websiteKeyboard(): InlineKeyboard {
  return new InlineKeyboard().url(
    "🔎 Wohnungen filtern",
    "https://wohnungsmarktberlin.de/overview",
  );
}

function sameFilter(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Register the /start, /stop and /status handlers on the bot. */
export function registerCommands(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const token = ctx.match?.trim();
    if (!token) {
      await ctx.reply(
        "👋 <b>Willkommen beim WohnungsMarktBerlin-Bot!</b>\n\n" +
          "Ich schicke dir eine Nachricht, sobald eine neue Wohnung erscheint, " +
          "die zu deinem Filter passt.\n\n" +
          "<b>So geht's:</b>\n" +
          "1️⃣ Öffne die Website und stelle deinen Filter ein.\n" +
          "2️⃣ Klicke auf „Auf Telegram benachrichtigen“.\n" +
          "3️⃣ Bestätige hier im Chat – fertig!\n\n" +
          "<b>Befehle:</b>\n" +
          "/status – deine aktiven Abos anzeigen\n" +
          "/stop – alle Benachrichtigungen beenden",
        { parse_mode: "HTML", reply_markup: websiteKeyboard() },
      );
      return;
    }

    const consumed = await consumeLinkToken(token);
    if (!consumed) {
      await ctx.reply(
        "⚠️ <b>Dieser Link ist ungültig oder wurde bereits verwendet.</b>\n\n" +
          "Bitte erstelle auf der Website einen neuen Benachrichtigungs-Link.",
        { parse_mode: "HTML", reply_markup: websiteKeyboard() },
      );
      return;
    }

    const chatId = String(ctx.chat.id);
    const existing = await db.query.notificationSubscriber.findMany({
      where: and(
        eq(notificationSubscriber.channel, "telegram"),
        eq(notificationSubscriber.target, chatId),
        eq(notificationSubscriber.active, true),
      ),
    });
    if (existing.some((s) => sameFilter(s.filterJson, consumed.filter))) {
      await ctx.reply(
        "ℹ️ <b>Dieses Abo ist bereits aktiv.</b>\n\n" +
          `Filter: <b>${escapeHtml(describeFlatFilter(consumed.filter))}</b>\n\n` +
          "Mit /status siehst du alle Abos, mit /stop beendest du sie.",
        { parse_mode: "HTML" },
      );
      return;
    }

    await db.insert(notificationSubscriber).values({
      id: Bun.randomUUIDv7(),
      channel: "telegram",
      target: chatId,
      filterJson: consumed.filter,
      active: true,
      createdAt: new Date(),
    });

    await ctx.reply(
      "✅ <b>Abo aktiviert!</b>\n\n" +
        `Du wirst benachrichtigt bei: <b>${escapeHtml(describeFlatFilter(consumed.filter))}</b>.\n\n` +
        "Nur zukünftige Inserate werden gesendet – bestehende Angebote nicht.\n\n" +
        "Mit /status siehst du deine Abos, mit /stop beendest du sie.",
      { parse_mode: "HTML" },
    );
  });

  bot.command("stop", async (ctx) => {
    const updated = await db
      .update(notificationSubscriber)
      .set({ active: false })
      .where(
        and(
          eq(notificationSubscriber.channel, "telegram"),
          eq(notificationSubscriber.target, String(ctx.chat.id)),
          eq(notificationSubscriber.active, true),
        ),
      )
      .returning();

    await ctx.reply(
      updated.length
        ? `🛑 <b>${updated.length} Abo(s) beendet.</b>\n\nDu erhältst keine Benachrichtigungen mehr. ` +
            "Über die Website kannst du jederzeit ein neues Abo anlegen."
        : "ℹ️ Du hast aktuell keine aktiven Abos.",
      { parse_mode: "HTML", reply_markup: websiteKeyboard() },
    );
  });

  bot.command("status", async (ctx) => {
    const subs = await db.query.notificationSubscriber.findMany({
      where: and(
        eq(notificationSubscriber.channel, "telegram"),
        eq(notificationSubscriber.target, String(ctx.chat.id)),
        eq(notificationSubscriber.active, true),
      ),
    });

    if (!subs.length) {
      await ctx.reply(
        "ℹ️ <b>Du hast aktuell keine aktiven Abos.</b>\n\n" +
          "Lege über die Website eines an, um benachrichtigt zu werden.",
        { parse_mode: "HTML", reply_markup: websiteKeyboard() },
      );
      return;
    }

    const list = subs
      .map(
        (s, i) => `${i + 1}. ${escapeHtml(describeFlatFilter(s.filterJson))}`,
      )
      .join("\n");
    await ctx.reply(
      `📋 <b>Deine aktiven Abos (${subs.length}):</b>\n${list}\n\nMit /stop beendest du alle.`,
      { parse_mode: "HTML" },
    );
  });
}
