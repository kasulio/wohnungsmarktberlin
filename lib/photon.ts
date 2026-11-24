import { type z } from "zod";
import { fetchJson } from "./http";
import { hashString } from "~/server/util";
import { db } from "~/server/db/client";
import { eq } from "drizzle-orm";
import { address as addressTable } from "~/server/db/schema";
import { createInsertSchema } from "drizzle-zod";
const insertAddressSchema = createInsertSchema(addressTable);

type GeocodedAddress = z.infer<typeof insertAddressSchema>;

export type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    city?: string;
    housenumber?: string;
    postcode?: string;
  };
};

type PhotonSearch = (query: string) => Promise<PhotonFeature | undefined>;

const searchPhoton: PhotonSearch = async (query) => {
  const params = new URLSearchParams({
    q: query,
    limit: "1",
    lat: "52.52",
    lon: "13.405",
  });
  const results = await fetchJson<{ features: PhotonFeature[] }>(
    `https://photon.komoot.io/api?${params}`,
  );
  return results.features[0];
};

/** "5B" in "Hildegardstr. 5B, 10715 Berlin"; OSM often only maps the "5". */
const LETTERED_HOUSE_NUMBER = /\b(\d+)\s?([a-z])(?=\s*(,|$))/i;

export async function geocode(
  id: string,
  address: string,
  search: PhotonSearch = searchPhoton,
): Promise<GeocodedAddress | undefined> {
  let feature = await search(address);
  let streetNumber = feature?.properties.housenumber;

  const lettered = address.match(LETTERED_HOUSE_NUMBER);
  if (feature && !streetNumber && lettered) {
    feature = await search(address.replace(LETTERED_HOUSE_NUMBER, "$1"));
    streetNumber = feature?.properties.housenumber && lettered[0];
  }
  if (!feature) return undefined;

  const parsed = insertAddressSchema.safeParse({
    id,
    street: feature.properties.street,
    city: feature.properties.city,
    streetNumber,
    postalCode: feature.properties.postcode,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  });
  return parsed.success ? parsed.data : undefined;
}

export async function getAddressFromPhoton(
  address: string,
): Promise<GeocodedAddress | undefined> {
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

    return await geocode(addressId, address);
  } catch (error) {
    console.error(error);
    return undefined;
  }
}
