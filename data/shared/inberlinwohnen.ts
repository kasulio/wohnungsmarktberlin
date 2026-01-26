/**
 * InBerlinWohnen (IBW) platform scraper
 * Shared by multiple municipal housing providers:
 * - Degewo (123)
 * - Gesobau (125)
 * - Gewobag (126)
 * - Howoge (152)
 * - Stadt und Land (153)
 * - WBM (154)
 */

import ky from "ky";
import { parse } from "node-html-parser";
import { z } from "zod";
import type { Flat } from "../propertyManagementList";
import { getAddress } from "../address";
import { hashString } from "~/server/util";
import { getApartmentTagsLocally } from "../tags";
import { getApartmentTagsViaAI } from "~/server/aiTagRetriever";
import { env } from "~/env";
import { parseGermanNumberString, cleanAddress } from "./utils";
import { flatSchema } from "../propertyManagementList";

/**
 * IBW provider IDs
 */
export const IBW_PROVIDERS = {
  degewo: "123",
  gesobau: "125",
  gewobag: "126",
  howoge: "152",
  stadtundland: "153",
  wbm: "154",
} as const;

export type IBWProviderKey = keyof typeof IBW_PROVIDERS;

/**
 * Fetch listings from IBW platform
 */
export async function fetchIBWListings(providerId: string): Promise<string> {
  try {
    const response = await ky.post(
      "https://inberlinwohnen.de/wp-content/themes/ibw/skript/wohnungsfinder.php",
      {
        body: new URLSearchParams({
          q: "wf-filter-search",
          lang: "de",
          filter_gesellschaft: providerId,
          user_order: "einstelldatum_desc",
        }),
      },
    );

    return await response.text();
  } catch (error) {
    console.error(
      `Error fetching IBW listings for provider ${providerId}:`,
      error,
    );
    return "";
  }
}

/**
 * Parse IBW HTML response to extract flat data
 */
export function parseIBWListings(
  html: string,
  providerName: string,
): IBWFlatOverview[] {
  if (!html || html.trim() === "") {
    return [];
  }

  const root = parse(html);
  const listings = root.querySelectorAll(".liste-objekte");

  return listings.map((listing) => {
    // Extract title
    const titleEl = listing.querySelector(".c1 a");
    const title = titleEl?.text?.trim() || "";
    const url = titleEl?.getAttribute("href") || "";

    // Extract address
    const addressEl = listing.querySelector(".c1 address");
    const address = cleanAddress(addressEl?.text) || "";

    // Extract details from table
    const rows = listing.querySelectorAll(".c2 tr");
    const data: Record<string, string> = {};

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        const key = cells[0]?.text?.trim().toLowerCase() || "";
        const value = cells[1]?.text?.trim() || "";
        data[key] = value;
      }
    });

    // Extract values
    const rooms = parseGermanNumberString(data["zimmer"] || data["rooms"]);
    const area = parseGermanNumberString(
      data["wohnfläche"] || data["fläche"] || data["area"],
    );
    const coldRent = parseGermanNumberString(
      data["kaltmiete"] || data["grundmiete"] || data["cold rent"],
    );
    const warmRent = parseGermanNumberString(
      data["gesamtmiete"] || data["warmmiete"] || data["total rent"],
    );

    // Extract image
    const imageEl = listing.querySelector("img");
    const imageUrl = imageEl?.getAttribute("src") || null;

    return {
      title,
      url,
      address,
      rooms,
      area,
      coldRent,
      warmRent,
      imageUrl,
    };
  });
}

export interface IBWFlatOverview {
  title: string;
  url: string;
  address: string;
  rooms: number | null;
  area: number | null;
  coldRent: number | null;
  warmRent: number | null;
  imageUrl: string | null;
}

/**
 * Convert IBW flat overview to Flat schema
 */
export async function ibwOverviewToFlat(
  overview: IBWFlatOverview,
  providerName: string,
): Promise<Flat | false> {
  if (!overview.url || !overview.title) {
    return false;
  }

  // Generate ID from URL
  const id = await hashString(overview.url);

  // Get cleaned address with geocoding
  if (!overview.address) {
    return false;
  }

  const address = await getAddress(id, overview.address);
  if (!address) {
    return false;
  }

  // Get tags
  const tags = env.OPENAI_API_KEY
    ? await getApartmentTagsViaAI(id, overview.title)
    : getApartmentTagsLocally(overview.title);

  // Create flat object
  const flat = {
    id,
    title: overview.title,
    coldRentPrice: overview.coldRent,
    warmRentPrice: overview.warmRent,
    roomCount: overview.rooms,
    usableArea: overview.area,
    address,
    floor: null,
    tags,
    imageUrl: overview.imageUrl,
    url: overview.url,
  } satisfies Flat;

  // Validate against schema
  const result = flatSchema.safeParse(flat);
  return result.success ? result.data : false;
}

/**
 * Fetch all flats from IBW platform for a specific provider
 */
export async function fetchIBWFlats(
  providerId: string,
  providerName: string,
): Promise<(Flat | false)[]> {
  const html = await fetchIBWListings(providerId);
  const overviews = parseIBWListings(html, providerName);

  const flats = await Promise.all(
    overviews.map((overview) => ibwOverviewToFlat(overview, providerName)),
  );

  return flats;
}
