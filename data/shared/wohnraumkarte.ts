/**
 * Wohnraumkarte (WRK) API client
 * Used by Vonovia and Deutsche Wohnen
 */

import ky from "ky";
import { z } from "zod";
import type { Flat } from "../propertyManagementList";
import { getAddress } from "../address";
import { hashString } from "~/server/util";
import { getApartmentTagsLocally } from "../tags";
import { getApartmentTagsViaAI } from "~/server/aiTagRetriever";
import { env } from "~/env";
import { parseGermanNumberString } from "./utils";
import { flatSchema } from "../propertyManagementList";

/**
 * Provider identifiers for WRK API
 */
export type WRKProvider = "vonovia" | "deuwo";

/**
 * Schema for WRK listing overview
 */
const wrkListingSchema = z.object({
  wrkID: z.string(),
  title: z.string().optional(),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  rooms: z.number().optional(),
  livingSpace: z.number().optional(),
  totalRent: z.number().optional(),
  baseRent: z.number().optional(),
});

/**
 * Schema for WRK detail response
 */
const wrkDetailSchema = z.object({
  wrkID: z.string(),
  title: z.string().optional(),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  rooms: z.number().optional(),
  livingSpace: z.number().optional(),
  totalRent: z.number().optional(),
  baseRent: z.number().optional(),
  floor: z.number().optional().nullable(),
  images: z.array(z.object({ url: z.string() })).optional(),
  detailsUrl: z.string().optional(),
});

type WRKListing = z.infer<typeof wrkListingSchema>;
type WRKDetail = z.infer<typeof wrkDetailSchema>;

/**
 * Fetch all listings from WRK API
 */
export async function fetchWRKListings(
  provider: WRKProvider,
): Promise<WRKListing[]> {
  try {
    const response = await ky
      .get("https://www.wohnraumkarte.de/api/getImmoList", {
        searchParams: {
          dataSet: provider,
        },
      })
      .json<unknown>();

    // Validate response is an array
    if (!Array.isArray(response)) {
      console.error("WRK API returned non-array response");
      return [];
    }

    // Parse and validate each listing
    const listings = response
      .map((item) => {
        const result = wrkListingSchema.safeParse(item);
        return result.success ? result.data : null;
      })
      .filter((item): item is WRKListing => item !== null);

    return listings;
  } catch (error) {
    console.error(`Error fetching WRK listings for ${provider}:`, error);
    return [];
  }
}

/**
 * Fetch detail information for a specific listing
 */
export async function fetchWRKDetail(
  wrkID: string,
  provider: WRKProvider,
): Promise<WRKDetail | null> {
  try {
    const response = await ky
      .get("https://www.wohnraumkarte.de/api/getImmoDetails", {
        searchParams: {
          wrkID,
          dataSet: provider,
        },
      })
      .json<unknown>();

    const result = wrkDetailSchema.safeParse(response);
    return result.success ? result.data : null;
  } catch (error) {
    console.error(
      `Error fetching WRK detail for ${wrkID} (${provider}):`,
      error,
    );
    return null;
  }
}

/**
 * Convert WRK detail to Flat schema
 */
export async function wrkDetailToFlat(
  detail: WRKDetail,
  provider: WRKProvider,
  providerName: string,
): Promise<Flat | false> {
  // Generate ID
  const id = await hashString(detail.wrkID);

  // Build address string
  const addressString = [
    detail.street,
    detail.houseNumber,
    detail.zipCode,
    detail.city,
  ]
    .filter(Boolean)
    .join(" ");

  if (!addressString) {
    return false;
  }

  // Get cleaned address with geocoding
  const address = await getAddress(id, addressString);
  if (!address) {
    return false;
  }

  // Get tags
  const title = detail.title || "Wohnung";
  const tags = env.OPENAI_API_KEY
    ? await getApartmentTagsViaAI(id, title)
    : getApartmentTagsLocally(title);

  // Build URL
  const url =
    detail.detailsUrl ||
    `https://www.wohnraumkarte.de/${provider}/wohnung/${detail.wrkID}`;

  // Get first image
  const imageUrl = detail.images?.[0]?.url || null;

  // Create flat object
  const flat = {
    id,
    title,
    coldRentPrice: detail.baseRent || null,
    warmRentPrice: detail.totalRent || null,
    roomCount: detail.rooms || null,
    usableArea: detail.livingSpace || null,
    address,
    floor: detail.floor || null,
    tags,
    imageUrl,
    url,
  } satisfies Flat;

  // Validate against schema
  const result = flatSchema.safeParse(flat);
  return result.success ? result.data : false;
}

/**
 * Fetch all flats from WRK API (overview only, no detail scraping)
 */
export async function fetchWRKFlats(
  provider: WRKProvider,
  providerName: string,
): Promise<(Flat | false)[]> {
  const listings = await fetchWRKListings(provider);

  // Convert listings to flats (treating overview as detail)
  const flats = await Promise.all(
    listings.map(async (listing) => {
      // Use listing as detail since overview has most fields
      const detail: WRKDetail = {
        wrkID: listing.wrkID,
        title: listing.title,
        street: listing.street,
        houseNumber: listing.houseNumber,
        zipCode: listing.zipCode,
        city: listing.city,
        rooms: listing.rooms,
        livingSpace: listing.livingSpace,
        totalRent: listing.totalRent,
        baseRent: listing.baseRent,
        floor: null,
        images: [],
      };

      return wrkDetailToFlat(detail, provider, providerName);
    }),
  );

  return flats;
}
