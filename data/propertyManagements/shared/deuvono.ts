import { parse } from "node-html-parser";
import { z } from "zod";
import { fetchJson as defaultFetchJson } from "~/lib/http";
import { parseNumberString } from "~/lib/parser";
import type { FlatForProviderIgnoreCheck, ScrapedFlat } from "../../schemas";

/** Zero-room and ≤100€ listings are almost always non-residential on Deuvono platforms. */
export function shouldIgnoreDeuvonoListing(
  flat: FlatForProviderIgnoreCheck,
): boolean {
  if (flat.roomCount === 0 || flat.roomCount == null) return true;
  const rent = flat.coldRentPrice ?? flat.warmRentPrice ?? null;
  return rent !== null && rent <= 100;
}

export type DeuvonoFetchJson = (
  url: string,
  options?: { headers?: Record<string, string> },
) => Promise<unknown>;

const PAGE_SIZE = 50; // the list API answers 406 above this
const MAX_PAGES = 40;

const listPageSchema = z.object({
  paging: z.object({ info: z.object({ count: z.number() }) }),
  results: z.array(z.object({ slug: z.string() })),
});

const searchToken = async (origin: string, fetchJson: DeuvonoFetchJson) => {
  const answer = await fetchJson(
    `${origin}/api/real-estate/search-token`,
  ).catch(() => null);
  const parsed = z.object({ token: z.string() }).safeParse(answer);
  return parsed.success ? parsed.data.token : null;
};

export const extractDeuvonoUrls = async (
  provider: "vonovia" | "deuwo",
  fetchJson: DeuvonoFetchJson = defaultFetchJson,
) => {
  const origin =
    provider === "vonovia"
      ? "https://www.vonovia.de"
      : "https://www.deutsche-wohnen.com";
  const listPath =
    provider === "vonovia"
      ? "/api/real-estate/list"
      : "/api/deuwo-real-estate/list";
  const token = await searchToken(origin, fetchJson);
  const headers = token ? { "X-VON-Search-Token": token } : undefined;

  const slugs: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(listPath, origin);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(page * PAGE_SIZE));
    url.searchParams.set("rentType", "miete");
    url.searchParams.set("city", "Berlin");
    url.searchParams.set("locationDisplay", "Berlin");
    url.searchParams.set("immoType", "wohnung");
    url.searchParams.set("dataSet", provider);

    const parsed = listPageSchema.safeParse(
      await fetchJson(url.toString(), { headers }),
    );
    if (!parsed.success) {
      throw new Error(`Failed to parse data: ${parsed.error}`);
    }
    slugs.push(...parsed.data.results.map((item) => item.slug));
    if (
      parsed.data.results.length < PAGE_SIZE ||
      slugs.length >= parsed.data.paging.info.count
    ) {
      break;
    }
  }

  return slugs.map((slug) =>
    provider === "vonovia"
      ? `https://www.vonovia.de/zuhause-finden/immobilien/${slug}`
      : `https://www.deutsche-wohnen.com/mieten/mietangebote/${slug}`,
  );
};

// Simplified schema - only includes fields that are actually used
const deuvonoDataSchema = z.object({
  heading: z.string().optional(),
  numberOfRooms: z
    .union([z.number().nonnegative(), z.string()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === "number") return val;
      return parseNumberString(val);
    }),
  space: z.string().nullable().optional(),
  rent: z.number().optional(),
  warmRent: z.number().optional(),
  streetAndHouseNumber: z.string().optional(),
  sections: z
    .array(
      z
        .object({
          rows: z
            .array(
              z.object({
                label: z.string().optional(),
                value: z.string().optional(),
              }),
            )
            .optional(),
        })
        .nullable(),
    )
    .optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
      }),
    )
    .optional(),
});

export function extractDeuvonoDataFromHtml(
  html: string,
  url: string,
): ScrapedFlat {
  const root = parse(html);

  // Extract JSON data from data-vonovia-data attribute
  const vonoviaElement = root.querySelector("[data-vonovia-data]");
  if (!vonoviaElement) {
    throw new Error("Could not find data-vonovia-data attribute");
  }

  const rawData = JSON.parse(
    vonoviaElement.getAttribute("data-vonovia-data") || "{}",
  );

  // Validate with zod
  const parseResult = deuvonoDataSchema.safeParse(rawData);
  if (!parseResult.success) {
    throw new Error(`Failed to parse deuvono data: ${parseResult.error}`);
  }

  const data = parseResult.data;

  // Parse address components
  const addressLine = data.streetAndHouseNumber || "";

  // Parse area from space (e.g., "33,20 m²" -> 33.20)
  const area = parseNumberString(data.space?.replace(/\s*m².*/, ""));

  // Extract floor from sections
  let floor: number | undefined;
  if (data.sections) {
    for (const section of data.sections) {
      if (section?.rows) {
        for (const row of section.rows) {
          if (
            row.label?.toLowerCase().includes("geschoss") ||
            row.label?.toLowerCase().includes("stockwerk")
          ) {
            // Parse floor number from strings like "4. Obergeschoß", "1. Untergeschoß", "Erdgeschoß"
            const value = row.value || "";
            const match = value.match(/^(\d+)\./);
            if (match) {
              floor = parseInt(match[1]!, 10);
            } else if (value.toLowerCase().includes("erdgeschoß")) {
              floor = 0;
            } else if (value.toLowerCase().includes("untergeschoß")) {
              // For basement, use negative floor numbers
              const basementMatch = value.match(/^(\d+)\.\s*untergeschoß/i);
              floor = basementMatch ? -parseInt(basementMatch[1]!, 10) : -1;
            }
            break;
          }
        }
        if (floor !== undefined) break;
      }
    }
  }

  // Extract image URLs
  const images = data.images?.map((img) => img.url).filter(Boolean);

  // coldRent is the base rent, warmRent includes additional costs
  const coldRent = data.rent || undefined;
  const warmRent =
    data.warmRent && data.warmRent > 0 ? data.warmRent : undefined;

  const title = data.heading || "Unknown";

  return {
    title,
    coldRentPrice: coldRent,
    warmRentPrice: warmRent,
    url,
    addressText: addressLine,
    usableArea: area,
    roomCount: data.numberOfRooms,
    floor,
    imageUrl: images?.[0] ?? undefined,
  } satisfies ScrapedFlat;
}
