import { z } from "zod";
import { fetchJson } from "./http";
import { hashString } from "~/server/util";
import { db } from "~/db/db";
import { eq } from "drizzle-orm";
import { address as addressTable } from "~/db/schema";
import { createInsertSchema } from "drizzle-zod";
const insertAddressSchema = createInsertSchema(addressTable);

export async function getAddressFromPhoton(
  address: string,
): Promise<z.infer<typeof insertAddressSchema> | undefined> {
  try {
    const addressId = hashString(address);

    const existingAddress = await db
      .select()
      .from(addressTable)
      .where(eq(addressTable.id, addressId))
      .limit(1);
    if (existingAddress.length > 0) {
      return existingAddress[0];
    }

    const results = await fetchJson(`https://photon.komoot.io/api`, {
      searchParams: {
        q: address,
        limit: 1,
        lat: "52.3879",
        lon: "13.0582",
      },
    });

    const feature = results.features[0];
    if (!feature) return undefined;

    const parsed = insertAddressSchema.safeParse({
      id: addressId,
      street: feature.properties.street,
      city: feature.properties.city,
      streetNumber: feature.properties.housenumber,
      postalCode: feature.properties.postcode,
      longitude: feature.geometry.coordinates[0],
      latitude: feature.geometry.coordinates[1],
    });

    if (!parsed.success) {
      console.error(parsed.error);
      return undefined;
    }

    return parsed.data;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}
