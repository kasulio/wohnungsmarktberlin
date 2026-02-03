import ky from "ky";
import { z } from "zod";
import { fetchHtml, fetchJson } from "./http";

const extendedAddressInformationSchema = z.object({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  address: z.object({
    street: z.string(),
    housenumber: z.string(),
    postcode: z.string(),
    city: z.string(),
    district: z.string(),
    osmId: z.number(),
  }),
});

export async function getAddressInformation(
  address: string
): Promise<z.infer<typeof extendedAddressInformationSchema> | undefined> {
  try {
    const results = await fetchJson(`https://photon.komoot.io/api`, {
      searchParams: {
        q: address,
        limit: 1,
        lat: "52.3879",
        lon: "13.0582",
      },
    });

    // @ts-ignore
    const feature = results?.features?.[0];
    if (!feature) return undefined;
    console.log({
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      },
      address: feature.properties,
    });
    const parsed = extendedAddressInformationSchema.safeParse({
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      },
      address: {
        ...feature.properties,
        osmId: feature.properties?.osm_id,
      },
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
