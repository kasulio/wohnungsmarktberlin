import { desc, eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { address as addressTable, flat as flatTable } from "~/server/db/schema";
import { publishableFlatFilter } from "~/lib/flat-publishability";
import { type NotifiableFlat } from "./types";

/** Projection matching `NotifiableFlat` (flat columns + joined address fields). */
const notifiableSelect = {
  id: flatTable.id,
  title: flatTable.title,
  propertyManagementId: flatTable.propertyManagementId,
  coldRentPrice: flatTable.coldRentPrice,
  warmRentPrice: flatTable.warmRentPrice,
  roomCount: flatTable.roomCount,
  usableArea: flatTable.usableArea,
  firstSeen: flatTable.firstSeen,
  postalCode: addressTable.postalCode,
  url: flatTable.url,
  street: addressTable.street,
  streetNumber: addressTable.streetNumber,
  city: addressTable.city,
  latitude: addressTable.latitude,
  longitude: addressTable.longitude,
} as const;

/**
 * Pick a representative publishable flat for test notifications — newest first,
 * preferring one that has an image so the photo path is exercised.
 */
export async function loadSampleNotifiableFlat(): Promise<NotifiableFlat | null> {
  const [row] = await db
    .select(notifiableSelect)
    .from(flatTable)
    .innerJoin(addressTable, eq(flatTable.addressId, addressTable.id))
    .where(publishableFlatFilter())
    .orderBy(sql`${flatTable.image} IS NULL`, desc(flatTable.firstSeen))
    .limit(1);
  return row ?? null;
}
