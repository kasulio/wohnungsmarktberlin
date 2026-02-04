import { parse } from "node-html-parser";
import { z } from "zod";
import { fetchJson } from "~/lib/http";
import { parseNumberString } from "~/lib/parser";
import { getApartmentTags } from "../../tags";
import type { ScrapedFlat } from "../../schemas";

export const extractDeuvonoUrls = async (provider: "vonovia" | "deuwo") => {
  const apiUrl =
    provider === "vonovia"
      ? "https://www.vonovia.de/api/real-estate/list"
      : "https://www.deutsche-wohnen.com/api/deuwo-real-estate/list";
  const url = new URL(apiUrl);
  url.searchParams.set("limit", "1000");
  url.searchParams.set("rentType", "miete");
  url.searchParams.set("city", "Berlin");
  url.searchParams.set("locationDisplay", "Berlin");
  url.searchParams.set("dataSet", provider);

  const data = await fetchJson(url.toString());

  const parsed = z
    .object({
      results: z.array(
        z.object({
          slug: z.string(),
        }),
      ),
    })
    .safeParse(data);

  if (!parsed.success) {
    throw new Error(`Failed to parse data: ${parsed.error}`);
  }
  return parsed.data.results.map((item) =>
    provider === "vonovia"
      ? `https://www.vonovia.de/zuhause-finden/immobilien/${item.slug}`
      : `https://www.deutsche-wohnen.com/mieten/mietangebote/${item.slug}`,
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
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
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
    usableArea: area ?? 0,
    roomCount: data.numberOfRooms ?? 0,
    floor,
    tags: getApartmentTags(title),
    imageUrl: images?.[0] ?? undefined,
  } satisfies ScrapedFlat;
}
