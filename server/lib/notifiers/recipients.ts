import { type FlatFilter } from "~/lib/flat-filters";

export type SubscriptionRow = {
  id: string;
  channel: string;
  target: string;
  filter: FlatFilter | null;
  active: boolean;
  source: "static" | "db";
  createdAt: Date;
  sentCount: number;
};

/** Distinct flats a channel+target received, across all its subscriptions. */
export type RecipientDelivery = {
  channel: string;
  target: string;
  delivered: number;
  lastSentAt: Date | null;
};

export type Recipient = {
  channel: string;
  target: string;
  source: "static" | "db";
  active: boolean;
  createdAt: Date;
  delivered: number;
  lastSentAt: Date | null;
  subscriptions: SubscriptionRow[];
};

const recipientKey = (r: { channel: string; target: string }) =>
  `${r.channel}\u0000${r.target}`;

/**
 * One entry per destination (channel + target): a Telegram chat with several
 * filters is several subscriber rows but one person. Active recipients first,
 * then people before code-defined hooks, then by flats delivered.
 */
export function groupByRecipient(
  subscriptions: SubscriptionRow[],
  deliveries: RecipientDelivery[],
): Recipient[] {
  const deliveryByKey = new Map(deliveries.map((d) => [recipientKey(d), d]));
  const byKey = new Map<string, Recipient>();

  for (const sub of subscriptions) {
    const key = recipientKey(sub);
    const existing = byKey.get(key);
    if (existing) {
      existing.subscriptions.push(sub);
      existing.active ||= sub.active;
      if (sub.createdAt < existing.createdAt)
        existing.createdAt = sub.createdAt;
      continue;
    }
    const delivery = deliveryByKey.get(key);
    byKey.set(key, {
      channel: sub.channel,
      target: sub.target,
      source: sub.source,
      active: sub.active,
      createdAt: sub.createdAt,
      delivered: delivery?.delivered ?? 0,
      lastSentAt: delivery?.lastSentAt ?? null,
      subscriptions: [sub],
    });
  }

  const recipients = [...byKey.values()];
  for (const r of recipients) {
    r.subscriptions.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
  return recipients.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(a.source === "static") - Number(b.source === "static") ||
      b.delivered - a.delivered,
  );
}
