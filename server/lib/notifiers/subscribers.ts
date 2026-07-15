import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { notificationSubscriber } from "~/server/db/schema";
import type { FlatFilter } from "~/lib/flat-filters";
import type { Subscriber } from "./types";

/**
 * Watermark for code-defined subscribers: captured at process start. Flats that
 * became publishable before the server booted count as backlog and are not
 * delivered — so restarting never blasts existing inventory to log/dev hooks.
 */
const STATIC_SINCE = new Date();

/**
 * Code-defined notification hooks (version-controlled). Each is a first-class
 * subscriber sharing the same ledger + watermark as DB subscriptions, so they
 * are a real rehearsal of the telegram/email consumers to come.
 */
export const staticSubscribers: Subscriber[] = [
  {
    id: "log:all",
    channel: "log",
    target: "all",
    filter: {},
    createdAt: STATIC_SINCE,
    source: "static",
  },
  {
    id: "log:cheap",
    channel: "log",
    target: "cheap",
    filter: { priceMin: 300, priceMax: 500 },
    createdAt: STATIC_SINCE,
    source: "static",
  },
  {
    id: "log:midsize",
    channel: "log",
    target: "midsize",
    filter: { roomsMin: 2, roomsMax: 4 },
    createdAt: STATIC_SINCE,
    source: "static",
  },
];

/** Merge code-defined hooks with active DB subscriptions into one list. */
export async function loadSubscribers(): Promise<Subscriber[]> {
  const rows = await db.query.notificationSubscriber.findMany({
    where: eq(notificationSubscriber.active, true),
  });

  const dbSubscribers: Subscriber[] = rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    target: r.target,
    filter: (r.filterJson ?? {}) as FlatFilter,
    createdAt: r.createdAt,
    source: "db",
  }));

  return [...staticSubscribers, ...dbSubscribers];
}
