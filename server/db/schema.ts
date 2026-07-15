import { relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
  unique,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import type { PropertyManagementId } from "~/data/propertyManagements/configs";
import type { Tags } from "~/data/tags";
import type { FlatFilter } from "~/lib/flat-filters";

export const signups = sqliteTable("signups", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  districts: text("districts", { mode: "json" }),
  maxPrice: integer("maxPrice").notNull(),
  minRooms: integer("minRooms").notNull(),
});

export const tag = sqliteTable("tag", {
  id: text("id").$type<Tags[number]>().primaryKey(),
  name: text("name").notNull(),
});

export const tagRelations = relations(tag, ({ many }) => ({
  flatToTag: many(flatToTag),
}));

export const flat = sqliteTable("flat", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => Bun.randomUUIDv7()),
  title: text("title").notNull(),
  coldRentPrice: integer("coldRentPrice"),
  warmRentPrice: integer("warmRentPrice"),
  roomCount: integer("roomCount"),
  usableArea: real("usableArea"),
  floor: integer("floor"),
  image: blob("image", { mode: "buffer" }),
  addressId: text("addressId"),
  addressText: text("addressText").notNull().default(""),
  addressImprovement: text("addressImprovement").default("pending"),
  propertyManagementId: text(
    "propertyManagementId",
  ).$type<PropertyManagementId>(),
  firstSeen: integer("firstSeen", { mode: "timestamp" }).notNull(),
  lastSeen: integer("lastSeen", { mode: "timestamp" }).notNull(),
  deleted: integer("deleted", { mode: "timestamp" }),
  ignored: integer("ignored", { mode: "boolean" }).notNull().default(false),
  /**
   * The moment the flat was first observed as publishable (see
   * `isPublishable`). Set once by the notification sweep; backfilled to the
   * migration timestamp for existing inventory so subscribers never get blasted
   * with the backlog. Doubles as the per-subscriber notification watermark.
   */
  firstPublishableAt: integer("firstPublishableAt", { mode: "timestamp" }),
  url: text("url").notNull().unique(),
});

export const flatUrlJob = sqliteTable("flatUrlJob", {
  url: text("url").notNull().primaryKey(),
  propertyManagementId: text("propertyManagementId")
    .$type<PropertyManagementId>()
    .notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  /** Capped error string from last failed extract attempt (see process-flat-url-jobs). */
  lastError: text("lastError"),
  attempts: integer("attempts").notNull().default(0),
});

export const scraperRun = sqliteTable(
  "scraperRun",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => Bun.randomUUIDv7()),
    kind: text("kind").notNull(),
    propertyManagementId: text(
      "propertyManagementId",
    ).$type<PropertyManagementId | null>(),
    success: integer("success", { mode: "boolean" }).notNull(),
    statsJson: text("statsJson").notNull(),
    errorMessage: text("errorMessage"),
    durationMs: integer("durationMs"),
    trigger: text("trigger").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    createdAtIdx: index("scraperRun_createdAt_idx").on(t.createdAt),
  }),
);

export const flatRelations = relations(flat, ({ one, many }) => ({
  address: one(address, { fields: [flat.addressId], references: [address.id] }),
  propertyManagement: one(propertyManagement, {
    fields: [flat.propertyManagementId],
    references: [propertyManagement.slug],
  }),
  flatToTag: many(flatToTag),
}));

export const flatToTag = sqliteTable(
  "flatToTag",
  {
    flatId: text("flatId").notNull(),
    tagId: text("tagId").$type<Tags[number]>().notNull(),
  },
  (t) => ({
    unq: unique().on(t.flatId, t.tagId),
    pk: primaryKey({ columns: [t.flatId, t.tagId] }),
  }),
);

export const flatToTagRelations = relations(flatToTag, ({ one }) => ({
  flat: one(flat, { fields: [flatToTag.flatId], references: [flat.id] }),
  tag: one(tag, { fields: [flatToTag.tagId], references: [tag.id] }),
}));

/**
 * A user-created notification consumer: one filter bound to one channel+target
 * (telegram chat, email address, …). Code-defined `log:*` hooks are NOT stored
 * here — they live in `server/lib/notifiers/subscribers.ts`.
 */
export const notificationSubscriber = sqliteTable("notificationSubscriber", {
  /**
   * Stable, unique id; also the ledger key. Static hooks use `${channel}:${target}`;
   * DB rows (e.g. telegram) use a generated id so one target can hold many filters.
   */
  id: text("id").primaryKey(),
  /** Delivery channel, resolved via the channel registry. */
  channel: text("channel").notNull(),
  /** Channel-specific destination: chat id, email address, … */
  target: text("target").notNull(),
  /** Normalized filter this consumer wants; null = match all. */
  filterJson: text("filterJson", { mode: "json" }).$type<FlatFilter | null>(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

/**
 * Append-only ledger of `(subscriber, flat)` pairs already delivered. A row
 * exists iff the notification was sent successfully, making the sweep
 * idempotent and crash-safe. `subscriberId` spans both static and DB sources.
 */
export const notificationSent = sqliteTable(
  "notificationSent",
  {
    subscriberId: text("subscriberId").notNull(),
    flatId: text("flatId").notNull(),
    sentAt: integer("sentAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriberId, t.flatId] })],
);

/**
 * Single-use tokens backing Telegram deep links. The website mints a row when a
 * visitor clicks "Notify me on Telegram"; the bot consumes it on `/start <token>`
 * to create a `notificationSubscriber`. Sidesteps Telegram's 64-char start-param
 * limit by keeping only the short token in the URL and the filter in the row.
 */
export const telegramLinkToken = sqliteTable("telegramLinkToken", {
  token: text("token").primaryKey(),
  filterJson: text("filterJson", { mode: "json" }).$type<FlatFilter | null>(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const address = sqliteTable("address", {
  id: text("id").primaryKey(),
  street: text("street").notNull(),
  city: text("city").notNull(),
  streetNumber: text("streetNumber").notNull(),
  postalCode: text("postalCode").notNull(),
  longitude: real("longitude"),
  latitude: real("latitude"),
});

export const addressRelations = relations(address, ({ many }) => ({
  flats: many(flat),
}));

export const propertyManagement = sqliteTable("propertyManagement", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const propertyManagementRelations = relations(
  propertyManagement,
  ({ many }) => ({
    flats: many(flat),
  }),
);

export * from "./auth-schema";
