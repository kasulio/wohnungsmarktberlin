import { type HTMLElement, parse } from "node-html-parser";
import { type PropertyManagement, type ScrapedFlat } from "../schemas";
import { fetchHtml } from "~/lib/http";
import { parseNumberString } from "~/lib/parser";
import { propertyManagementConfigs } from "./configs";

const GEWOBAG_BORLABS_COOKIE = JSON.stringify({
  consents: {
    essential: [
      "borlabs-cookie",
      "accessibility_contrast",
      "accessibility_test_size",
      "location_agreement",
    ],
  },
  domainPath: "www.gewobag.de/",
  expires: "Sun, 26 Jul 2026 12:26:03 GMT",
  uid: "anonymous",
  v3: true,
  version: 2,
});

function getFetchOptions() {
  return {
    headers: {
      Cookie: `borlabs-cookie=${encodeURIComponent(GEWOBAG_BORLABS_COOKIE)}`,
    },
  };
}

export const gewobag = {
  ...propertyManagementConfigs.gewobag,
  getFetchOptions,
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

const LISTING_URL =
  "https://www.gewobag.de/fuer-mietinteressentinnen/mietangebote/?objekttyp%5B%5D=wohnung&gesamtmiete_von=&gesamtmiete_bis=&gesamtflaeche_von=&gesamtflaeche_bis=&zimmer_von=&zimmer_bis=&sort-by=";
const MAX_PAGES = 20;

async function extractUrls() {
  const urls = new Set<string>();

  // Pages past the last one are 404s, so follow the "next" link instead of
  // counting up.
  let pageUrl: string | undefined = LISTING_URL;
  for (let page = 0; pageUrl && page < MAX_PAGES; page++) {
    const root: HTMLElement = parse(
      await fetchHtml(pageUrl, getFetchOptions()),
    );
    for (const item of root.querySelectorAll(".angebot-big-box")) {
      const href = item
        .querySelector(".angebot-footer a")
        ?.getAttribute("href");
      if (href) urls.add(href);
    }
    pageUrl = root
      .querySelector(".archive-pagination a.next")
      ?.getAttribute("href")
      ?.replaceAll("&amp;", "&");
  }

  return [...urls];
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  const title = root.querySelector("h1")?.textContent.trim();

  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  // Extract pricing information
  const pricingData = extractPricingData(root);

  // Extract general flat data
  const generalData = extractGeneralData(root);

  // Extract images
  const images = extractImages(root);

  return {
    title,
    coldRentPrice: pricingData.coldRent,
    warmRentPrice: pricingData.warmRent,
    url: href,
    addressText: generalData.address ?? "",
    usableArea: generalData.area,
    roomCount: generalData.rooms,
    floor: generalData.floor,
    imageUrl: images[0] ?? undefined,
  } satisfies ScrapedFlat;
}

/**
 * Extract pricing data from tables
 */
function extractPricingData(root: HTMLElement) {
  const pricingData: {
    coldRent?: number;
    warmRent?: number;
  } = {};

  // Find the pricing table
  const pricingTable = root.querySelector("table");
  if (pricingTable) {
    const rows = pricingTable.querySelectorAll("tr");

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td,th");

      if (cells.length === 2) {
        const key = cells[0]!.textContent.trim().toLowerCase();
        const value = cells[1]!.textContent.trim();

        if (key.includes("grundmiete")) {
          pricingData.coldRent = parseNumberString(value);
        } else if (key.includes("gesamtmiete")) {
          pricingData.warmRent = parseNumberString(value);
        }
      }
    });
  }

  return pricingData;
}

/**
 * Extract general flat data from tables
 */
function extractGeneralData(root: HTMLElement) {
  const generalData: {
    address?: string;
    rooms?: number;
    area?: number;
    floor?: number;
  } = {};

  // Find all tables and extract general data
  const tables = root.querySelectorAll("table");

  tables.forEach((table) => {
    const rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td,th");
      if (cells.length === 2) {
        const key = cells[0]!.textContent.trim().toLowerCase();
        const value = cells[1]!.textContent.trim();

        if (key.includes("anschrift")) {
          generalData.address = value;
        } else if (key.includes("anzahl zimmer")) {
          generalData.rooms = parseFloat(value);
        } else if (key.includes("fläche")) {
          const areaMatch = /([\d,]+)/.exec(value);
          if (areaMatch) {
            generalData.area = parseNumberString(areaMatch[1]!);
          }
        } else if (key.includes("etage")) {
          const floorNum = parseInt(value);
          if (!isNaN(floorNum)) {
            generalData.floor = floorNum;
          }
        }
      }
    });
  });

  return generalData;
}

/**
 * Extract image URLs
 */
function extractImages(root: HTMLElement) {
  // Find images in the gallery
  return root
    .querySelectorAll(".angebot-slider img")
    .map((img) => img.getAttribute("src"))
    .filter(Boolean)
    .map((src) =>
      src.startsWith("http") ? src : `https://www.gewobag.de${src}`,
    )
    .slice(0, 5);
}
