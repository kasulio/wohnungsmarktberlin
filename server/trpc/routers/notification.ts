import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { env } from "~/env";
import { db } from "~/server/db/client";
import { notificationSent, notificationSubscriber } from "~/server/db/schema";
import { flatFilterSchema } from "~/lib/flat-filters";
import { channels } from "~/server/lib/notifiers/registry";
import { staticSubscribers } from "~/server/lib/notifiers/subscribers";
import { loadSampleNotifiableFlat } from "~/server/lib/notifiers/flat-query";
import { mintLinkToken } from "~/server/lib/notifiers/telegram/link-token";

export const notificationRouter = router({
  /**
   * Mint a single-use Telegram deep link for the given filter. The visitor opens
   * it, the bot consumes the token on `/start`, and a subscriber is created.
   */
  createTelegramLink: publicProcedure
    .input(flatFilterSchema)
    .mutation(async ({ input }) => {
      if (!env.TELEGRAM_BOT_USERNAME) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Telegram-Benachrichtigungen sind derzeit nicht verfügbar.",
        });
      }
      const username = env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
      const token = await mintLinkToken(input);
      return {
        url: `https://t.me/${username}?start=${token}`,
      };
    }),

  /** Admin: all notification subscribers (code-defined hooks + DB rows). */
  listSubscribers: protectedProcedure.query(async () => {
    const rows = await db.query.notificationSubscriber.findMany();
    const sentCounts = await db
      .select({ subscriberId: notificationSent.subscriberId, sent: count() })
      .from(notificationSent)
      .groupBy(notificationSent.subscriberId);
    const countBySubscriber = new Map(
      sentCounts.map((r) => [r.subscriberId, r.sent]),
    );

    const staticList = staticSubscribers.map((s) => ({
      id: s.id,
      channel: s.channel,
      target: s.target,
      filter: s.filter,
      active: true,
      source: "static" as const,
      createdAt: s.createdAt,
      sentCount: countBySubscriber.get(s.id) ?? 0,
    }));
    const dbList = rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      target: r.target,
      filter: r.filterJson,
      active: r.active,
      source: "db" as const,
      createdAt: r.createdAt,
      sentCount: countBySubscriber.get(r.id) ?? 0,
    }));

    return [...staticList, ...dbList];
  }),

  /**
   * Admin: send a one-off test notification to a subscriber's channel/target
   * using a sample listing. Bypasses filter + ledger; nothing is recorded.
   */
  sendTest: protectedProcedure
    .input(z.object({ subscriberId: z.string() }))
    .mutation(async ({ input }) => {
      const staticSub = staticSubscribers.find(
        (s) => s.id === input.subscriberId,
      );
      const resolved = staticSub
        ? { channel: staticSub.channel, target: staticSub.target }
        : await db.query.notificationSubscriber
            .findFirst({
              where: eq(notificationSubscriber.id, input.subscriberId),
            })
            .then((r) => (r ? { channel: r.channel, target: r.target } : null));

      if (!resolved) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Abo nicht gefunden.",
        });
      }

      const channel = channels[resolved.channel];
      if (!channel) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Unbekannter Kanal „${resolved.channel}“.`,
        });
      }

      const flat = await loadSampleNotifiableFlat();
      if (!flat) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Keine geeignete Beispiel-Wohnung gefunden.",
        });
      }

      const result = await channel.send(resolved.target, flat);
      return {
        ok: result.ok,
        blocked: result.ok ? false : result.blocked,
        flatId: flat.id,
      };
    }),
});
