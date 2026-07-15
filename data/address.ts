import { Client } from "@googlemaps/google-maps-services-js";
import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import { db } from "~/server/db/client";
import { address, flat } from "~/server/db/schema";
import { env } from "~/env";
import { hashString } from "~/server/util";

export const insertAddressSchema = createInsertSchema(address);

export const getAddress = async (flatId: string, rawAddressString: string) => {
  const existingAddress = await db
    .select()
    .from(address)
    .leftJoin(flat, eq(flat.addressId, address.id))
    .where(eq(flat.id, flatId))
    .limit(1);
  const existing = existingAddress[0];
  if (existing?.address) {
    return existing.address;
  }

  const client = new Client({});
  const x = await client.geocode({
    params: {
      address: rawAddressString,
      key: env.GOOGLE_MAPS_API_KEY ?? "",
      region: "de",
      language: "de",
      components: "country:DE",
    },
  });
  const addressData = x.data.results[0];
  if (!addressData) {
    return null;
  }

  const addressComponentMap = {
    street_number: "streetNumber",
    route: "street",
    sublocality_level_1: "district",
    locality: "city",
    postal_code: "zipCode",
  } as const;

  const addressComponents = addressData.address_components.reduce(
    (acc, cur) => {
      Object.entries(addressComponentMap).forEach(([key, value]) => {
        if (cur.types.includes(key)) {
          acc[value] = cur.long_name;
        }
      });

      return acc;
    },
    {} as Record<
      (typeof addressComponentMap)[keyof typeof addressComponentMap],
      string
    >,
  );

  const googleAddress = {
    id: await hashString(
      addressComponents.street +
        addressComponents.streetNumber +
        addressComponents.zipCode +
        addressComponents.city,
    ),
    postalCode: addressComponents.zipCode,
    street: addressComponents.street,
    city: addressComponents.city,
    streetNumber: addressComponents.streetNumber,
    longitude: addressData.geometry.location.lng,
    latitude: addressData.geometry.location.lat,
  } satisfies z.infer<typeof insertAddressSchema>;

  const result = insertAddressSchema.safeParse(googleAddress);
  if (result.success) {
    return result.data;
  } else {
    // console.log(address);
    return null;
  }
};
