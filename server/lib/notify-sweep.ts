import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  address as addressTable,
  flat as flatTable,
  notificationSent,
  notificationSubscriber,
} from "~/server/db/schema";
import { publishableFlatFilter } from "~/lib/flat-publishability";
import { matchesFilter } from "~/lib/flat-filters";
import { channels as defaultChannels } from "~/server/lib/notifiers/registry";
import { loadSubscribers } from "~/server/lib/notifiers/subscribers";
import type {
  Channel,
  NotifiableFlat,
  Subscriber,
} from "~/server/lib/notifiers/types";

/**
 * How far back the sweep looks for freshly-publishable flats. Bounds the scan
 * while comfortably covering scheduler downtime; older flats are considered
 * already-delivered (or predate every subscriber's watermark).
 */
const NOTIFY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Pacing between sends to stay well under channel rate limits. */
const SEND_INTERVAL_MS = 1000;

export type NotifySweepStats = {
  stamped: number;
  subscribers: number;
  candidates: number;
  sent: number;
  deactivated: number;
};

export type RunNotifySweepOptions = {
  /** Injectable clock for deterministic tests. */
  now?: Date;
  /** Pacing between sends; 0 to disable in tests. */
  sendIntervalMs?: number;
  /** Override the subscriber set (defaults to static hooks + active DB rows). */
  subscribers?: Subscriber[];
  /** Override the channel registry (e.g. a capturing channel in tests). */
  channels?: Record<string, Channel>;
};

/** Destination-level key: one physical delivery per (channel, target, flat). */
function deliveryKey(channel: string, target: string, flatId: string): string {
  return `${channel}\0${target}\0${flatId}`;
}

/**
 * Channel-agnostic sweep + append-only ledger. Idempotent and crash-safe: it
 * reads "publishable AND not yet sent", matches each subscriber's filter,
 * dispatches through that subscriber's channel, and records on success.
 * Multiple subscriptions sharing a channel+target get one send per flat; each
 * matching subscriber still gets a ledger row (per-filter sent counts).
 * Touches no scraper write-path code.
 */
export async function runNotifySweep(
  options: RunNotifySweepOptions = {},
): Promise<NotifySweepStats> {
  const now = options.now ?? new Date();
  const sendIntervalMs = options.sendIntervalMs ?? SEND_INTERVAL_MS;
  const channels = options.channels ?? defaultChannels;
  const stats: NotifySweepStats = {
    stamped: 0,
    subscribers: 0,
    candidates: 0,
    sent: 0,
    deactivated: 0,
  };

  // 1. Stamp the became-publishable moment (once) for newly-publishable flats.
  const stamped = await db
    .update(flatTable)
    .set({ firstPublishableAt: now })
    .where(and(publishableFlatFilter(), isNull(flatTable.firstPublishableAt)))
    .returning({ id: flatTable.id });
  stats.stamped = stamped.length;

  // 2. Subscribers (code-defined hooks + active DB rows).
  const subscribers = options.subscribers ?? (await loadSubscribers());
  stats.subscribers = subscribers.length;
  if (subscribers.length === 0) {
    logStats(stats);
    return stats;
  }

  // 3. Candidate flats: publishable, stamped within the lookback window.
  const lookbackThreshold = new Date(now.getTime() - NOTIFY_LOOKBACK_MS);
  const candidateRows = await db
    .select({
      id: flatTable.id,
      title: flatTable.title,
      propertyManagementId: flatTable.propertyManagementId,
      coldRentPrice: flatTable.coldRentPrice,
      warmRentPrice: flatTable.warmRentPrice,
      roomCount: flatTable.roomCount,
      usableArea: flatTable.usableArea,
      firstSeen: flatTable.firstSeen,
      firstPublishableAt: flatTable.firstPublishableAt,
      url: flatTable.url,
      street: addressTable.street,
      streetNumber: addressTable.streetNumber,
      postalCode: addressTable.postalCode,
      city: addressTable.city,
      latitude: addressTable.latitude,
      longitude: addressTable.longitude,
    })
    .from(flatTable)
    .innerJoin(addressTable, eq(flatTable.addressId, addressTable.id))
    .where(
      and(
        publishableFlatFilter(),
        gte(flatTable.firstPublishableAt, lookbackThreshold),
      ),
    );
  stats.candidates = candidateRows.length;
  if (candidateRows.length === 0) {
    logStats(stats);
    return stats;
  }

  // 4. Existing ledger rows → per-subscriber + per-destination dedup sets.
  const candidateIds = candidateRows.map((r) => r.id);
  const ledgerRows = await db
    .select({
      subscriberId: notificationSent.subscriberId,
      flatId: notificationSent.flatId,
    })
    .from(notificationSent)
    .where(inArray(notificationSent.flatId, candidateIds));
  const alreadySent = new Set(
    ledgerRows.map((r) => `${r.subscriberId} ${r.flatId}`),
  );

  const destinationBySubId = new Map(
    subscribers.map((s) => [s.id, { channel: s.channel, target: s.target }]),
  );
  // Inactive / deleted-from-active subs may still own ledger rows — resolve
  // their destinations so a sibling subscription on the same target won't re-send.
  const unresolvedIds = [
    ...new Set(
      ledgerRows
        .map((r) => r.subscriberId)
        .filter((id) => !destinationBySubId.has(id)),
    ),
  ];
  if (unresolvedIds.length > 0) {
    const inactiveRows = await db
      .select({
        id: notificationSubscriber.id,
        channel: notificationSubscriber.channel,
        target: notificationSubscriber.target,
      })
      .from(notificationSubscriber)
      .where(inArray(notificationSubscriber.id, unresolvedIds));
    for (const r of inactiveRows) {
      destinationBySubId.set(r.id, { channel: r.channel, target: r.target });
    }
  }

  const deliveredToTarget = new Set<string>();
  for (const r of ledgerRows) {
    const dest = destinationBySubId.get(r.subscriberId);
    if (dest) {
      deliveredToTarget.add(deliveryKey(dest.channel, dest.target, r.flatId));
    }
  }

  async function stampLedger(subscriberId: string, flatId: string) {
    await db
      .insert(notificationSent)
      .values({ subscriberId, flatId, sentAt: new Date() })
      .onConflictDoNothing();
    alreadySent.add(`${subscriberId} ${flatId}`);
  }

  // 5. For each (subscriber, candidate) first-publish match: deliver once per
  //    destination; stamp every matching subscriber's ledger row.
  for (const sub of subscribers) {
    const channel = channels[sub.channel];
    if (!channel) {
      console.warn(
        `[notify] subscriber ${sub.id} references unknown channel "${sub.channel}" — skipping`,
      );
      continue;
    }

    let deactivated = false;
    for (const row of candidateRows) {
      if (deactivated) break;
      // First-publish watermark: only flats publishable after the subscriber.
      if (!row.firstPublishableAt || row.firstPublishableAt <= sub.createdAt) {
        continue;
      }
      if (alreadySent.has(`${sub.id} ${row.id}`)) continue;
      if (!matchesFilter(row, sub.filter, now)) continue;

      const destKey = deliveryKey(sub.channel, sub.target, row.id);
      if (deliveredToTarget.has(destKey)) {
        // Same chat/address already got this flat via another subscription.
        await stampLedger(sub.id, row.id);
        continue;
      }

      const flat: NotifiableFlat = row;
      const result = await channel.send(sub.target, flat);

      if (result.ok) {
        await stampLedger(sub.id, row.id);
        deliveredToTarget.add(destKey);
        stats.sent++;
        if (sendIntervalMs > 0) await Bun.sleep(sendIntervalMs);
      } else if (result.blocked) {
        // Only DB subscriptions can be deactivated; static hooks just warn.
        if (sub.source === "db") {
          await db
            .update(notificationSubscriber)
            .set({ active: false })
            .where(eq(notificationSubscriber.id, sub.id));
        } else {
          console.warn(
            `[notify] static subscriber ${sub.id} reported blocked — cannot deactivate`,
          );
        }
        stats.deactivated++;
        deactivated = true;
      }
      // Non-blocked failures are left for the next tick to retry.
    }
  }

  logStats(stats);
  return stats;
}

function logStats(stats: NotifySweepStats) {
  console.log(
    `[task:notify] stamped ${stats.stamped}, subscribers ${stats.subscribers}, candidates ${stats.candidates}, sent ${stats.sent}, deactivated ${stats.deactivated}`,
  );
}
