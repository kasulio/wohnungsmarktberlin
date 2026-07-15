import { parseNumberString } from "~/lib/parser";
import { parse } from "node-html-parser";
import { z } from "zod";

import {
  scrapedFlatSchema,
  type PropertyManagement,
  type ScrapedFlat,
} from "../schemas";
import { propertyManagementConfigs } from "./configs";

export const stadtundland = {
  ...propertyManagementConfigs.stadtundland,
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls() {
  let offset = 0;
  const urls = [];
  let totalCount = 0;
  while (offset <= 100) {
    const url = "https://d2396ha8oiavw0.cloudfront.net/sul-main/immoSearch";
    const options = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offset: offset, cat: "wohnung" }),
    };

    const json = await fetch(url, options).then((res) => res.json());

    const parsed = z
      .object({
        count: z.number(),
        data: z.array(
          z.object({ details: z.object({ immoNumber: z.string() }) }),
        ),
      })
      .safeParse(json);
    if (!parsed.success) {
      throw new Error(`Failed to parse JSON: ${parsed.error}`);
    }

    const { count, data } = parsed.data;
    totalCount = count;

    urls.push(
      ...data.map(
        (item) =>
          `https://stadtundland.de/wohnungssuche/${encodeURIComponent(item.details.immoNumber)}`,
      ),
    );

    offset += 10;
    if (offset >= totalCount) {
      break;
    }
  }
  return Array.from(new Set(urls));
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  // Extract title from h1
  const title = root.querySelector("h1")?.textContent.trim();
  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  // Helper function to extract values from the table
  const getTableValue = (label: string): string | undefined => {
    const rows = root.querySelectorAll("table tbody tr");
    for (const row of rows) {
      const th = row.querySelector("th");
      const td = row.querySelector("td");
      if (th?.textContent.trim() === label && td) {
        return td.textContent.trim();
      }
    }
    return undefined;
  };

  // Extract basic information
  const address = getTableValue("Adresse");
  if (!address) {
    throw new Error(`Address not found for flat ${href}`);
  }

  // Parse area (Wohnfläche / Nutzfläche)
  const areaText = getTableValue("Wohnfläche / Nutzfläche")
    ?.replace("m²", "")
    .trim();
  const area = parseNumberString(areaText);

  // Parse rooms (Anzahl der Zimmer)
  const roomsText = getTableValue("Anzahl der Zimmer")?.trim();
  const rooms = parseNumberString(roomsText);

  // Parse floor (Etage)
  const floorText = getTableValue("Etage")?.trim();
  const floor = parseNumberString(floorText);

  // Parse rental prices
  const coldRentText = getTableValue("Kaltmiete")?.replace("€", "").trim();
  const coldRent = parseNumberString(coldRentText);
  if (!coldRent) {
    throw new Error(`Cold rent not found for flat ${href}`);
  }

  const warmRentText = getTableValue("Gesamtmiete")?.replace("€", "").trim();
  const warmRent = parseNumberString(warmRentText);

  // Extract image from Next.js img with the featured (large) size
  // src is like: /_next/image?url=https%3A%2F%2Fd2396ha8oiavw0.cloudfront.net%2F...&w=1920&q=75
  const featuredImg = root.querySelector('img[data-nimg="1"][width="675"]');
  let imageUrl: string | undefined;
  if (featuredImg) {
    const src = featuredImg.getAttribute("src");
    if (src) {
      try {
        imageUrl =
          new URL(src, "https://stadtundland.de").searchParams.get("url") ??
          undefined;
      } catch {
        // ignore invalid URLs
      }
    }
  }

  return {
    title,
    coldRentPrice: coldRent,
    warmRentPrice: warmRent,
    url: href,
    addressText: address,
    usableArea: area,
    roomCount: rooms,
    floor,
    imageUrl,
  } satisfies ScrapedFlat;
}
