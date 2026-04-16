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
import type { Tags } from "~/data/tags";

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
  propertyManagementId: text("propertyManagementId"),
  firstSeen: integer("firstSeen", { mode: "timestamp" }).notNull(),
  lastSeen: integer("lastSeen", { mode: "timestamp" }).notNull(),
  deleted: integer("deleted", { mode: "timestamp" }),
  ignored: integer("ignored", { mode: "boolean" }).notNull().default(false),
  url: text("url").notNull(),
});

export const flatUrlJob = sqliteTable("flatUrlJob", {
  url: text("url").notNull().primaryKey(),
  propertyManagementId: text("propertyManagementId").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const scraperRun = sqliteTable(
  "scraperRun",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => Bun.randomUUIDv7()),
    kind: text("kind").notNull(),
    propertyManagementId: text("propertyManagementId"),
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
