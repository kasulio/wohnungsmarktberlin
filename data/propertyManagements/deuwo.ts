import { parse } from "node-html-parser";
import { z } from "zod";

import { getApartmentTags } from "../tags";
import {
  scrapedFlatSchema,
  type PropertyManagement,
  type ScrapedFlat,
} from "../schemas";
import { extractDeuvonoUrls } from "./shared/deuvono";
import { parseNumberString } from "~/lib/parser";

const vonoviaDataSchema = z.object({
  objectId: z.string(),
  contactFirstname: z.string().optional(),
  contactSurename: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().nullable().optional(),
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
  operatingCosts: z.number().optional(),
  heatingCosts: z.number().optional(),
  securityDeposit: z.number().optional(),
  energyPassValueClass: z.string().optional(),
  constructionYear: z.string().optional(),
  heatingType: z.string().optional(),
  streetAndHouseNumber: z.string().optional(),
  postCodeAndCity: z.string().optional(),
  description: z.string().optional(),
  sections: z
    .array(
      z
        .object({
          heading: z.string().optional(),
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
        caption: z.string().optional(),
      }),
    )
    .optional(),
  features: z.array(z.any()).optional(),
  availableFrom: z.string().optional(),
});

export const deuwo = {
  slug: "deuwo",
  name: "Deutsche Wohnen",
  website: "https://www.deutsche-wohnen.com",
  extractUrls: () => extractDeuvonoUrls("deuwo"),
  extractDataFromHtml,
} as const satisfies PropertyManagement;

function extractDataFromHtml(html: string, url: string) {
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
  const parseResult = vonoviaDataSchema.safeParse(rawData);
  if (!parseResult.success) {
    throw new Error(`Failed to parse vonovia data: ${parseResult.error}`);
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
