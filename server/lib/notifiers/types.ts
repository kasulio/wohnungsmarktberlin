import type { FilterableFlat, FlatFilter } from "~/lib/flat-filters";

/** A publishable flat plus the fields a notification message renders. */
export type NotifiableFlat = FilterableFlat & {
  url: string;
  street: string | null;
  streetNumber: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Result of attempting to deliver one notification. */
export type SendResult =
  | { ok: true }
  /** Delivery failed. `blocked` = the target is gone/blocked us (deactivate it). */
  | { ok: false; blocked: boolean };

/**
 * A delivery transport (log / telegram / email). `target` is channel-specific:
 * a chat id for telegram, an address for email, a label for log. Registered in
 * `registry.ts`; the sweep depends only on this shape.
 */
export type Channel = {
  send(target: string, flat: NotifiableFlat): Promise<SendResult>;
};

/**
 * One filter bound to one channel+target — the unit the sweep iterates. Comes
 * from two sources: code-defined `static` hooks and user-created `db` rows.
 * Both share the same ledger + first-publish watermark machinery.
 */
export type Subscriber = {
  /** Stable, unique across sources. Convention: `${channel}:${target}`. */
  id: string;
  channel: string;
  target: string;
  filter: FlatFilter;
  /** Watermark: only flats first publishable after this are delivered. */
  createdAt: Date;
  source: "static" | "db";
};
