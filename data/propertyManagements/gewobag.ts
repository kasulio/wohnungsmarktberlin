import { HTMLElement, parse } from "node-html-parser";
import { getApartmentTags } from "../tags";
import { flatSchema, type PropertyManagement, type Flat } from "../schemas";
import { fetchHtml } from "~/lib/http";
import { parseNumberString } from "~/lib/parser";

export const gewobag = {
  slug: "gewobag",
  name: "Gewobag",
  website: "https://www.gewobag.de/",
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls() {
  const html = await fetchHtml(
    "https://www.gewobag.de/fuer-mietinteressentinnen/mietangebote/?objekttyp%5B%5D=wohnung&gesamtmiete_von=&gesamtmiete_bis=&gesamtflaeche_von=&gesamtflaeche_bis=&zimmer_von=&zimmer_bis=&sort-by=",
  );
  const root = parse(html);
  const items = root.querySelectorAll(".angebot-big-box");

  return items
    .map((item) => {
      const href = item
        .querySelector(".angebot-footer a")
        ?.getAttribute("href");

      if (!href) {
        return null;
      }

      return href;
    })
    .filter(Boolean);
}

function extractDataFromHtml(html: string, href: string) {
  const id = href.split("/").slice(-2)[0]!;
  const root = parse(html);

  const title = root.querySelector("h1")?.textContent.trim();

  // Extract pricing information
  const pricingData = extractPricingData(root);

  // Extract general flat data
  const generalData = extractGeneralData(root);

  // Extract features/amenities
  const features = extractFeatures(root);

  // Extract descriptions
  const descriptions = extractDescriptions(root);

  const floorPlan = extractFloorPlan(root);

  // Extract images
  const images = extractImages(root);

  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  // Build the final scraped flat object
  const scrapedFlat: Flat = {
    id,
    title,
    coldRentPrice: pricingData.coldRent,
    warmRentPrice: pricingData.warmRent,
    url: href,
    addressText: generalData.address ?? "",

    // Optional fields
    usableArea: generalData.area ?? 0,
    roomCount: generalData.rooms ?? 0,
    floor: generalData.floor,

    tags: getApartmentTags(title),
    imageUrl: images[0] ?? undefined,
  };

  return flatSchema.parse(scrapedFlat);
}

/**
 * Extract pricing data from tables
 */
function extractPricingData(root: HTMLElement) {
  const pricingData: {
    coldRent?: number;
    warmRent?: number;
    additionalCosts?: number;
    heatingCosts?: number;
    deposit?: number;
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
        } else if (key.includes("betriebskosten kalt")) {
          pricingData.additionalCosts = parseNumberString(value);
        } else if (key.includes("betriebskosten warm")) {
          pricingData.heatingCosts = parseNumberString(value);
        } else if (key.includes("kaution")) {
          pricingData.deposit = parseNumberString(value);
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
    neighborhood?: string;
    rooms?: number;
    area?: number;
    floor?: number;
    buildingYear?: number;
    availableFrom?: string;
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
        } else if (key.includes("bezirk") || key.includes("ortsteil")) {
          generalData.neighborhood = value;
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
        } else if (key.includes("baujahr")) {
          const year = parseInt(value);
          if (!isNaN(year)) {
            generalData.buildingYear = year;
          }
        } else if (key.includes("frei ab")) {
          generalData.availableFrom = value;
        }
      }
    });
  });

  return generalData;
}

/**
 * Extract features and amenities
 */
function extractFeatures(root: HTMLElement) {
  const features: {
    hasBalcony?: boolean;
    hasElevator?: boolean;
    hasBathtub?: boolean;
    hasShower?: boolean;
    hasKitchen?: boolean;
    isBarrierFree?: boolean;
    heatingType?: string;
  } = {};

  // Look for the features table (usually labeled "Merkmale")
  const tables = root.querySelectorAll("table");
  let featuresText = "";

  // Strategy 1: Look for table with "Merkmale" or "besondere Eigenschaften"
  for (const table of tables) {
    const text = table.textContent;
    if (text.includes("Merkmale") || text.includes("besondere Eigenschaften")) {
      featuresText = text.toLowerCase();
      break;
    }
  }

  // Strategy 2: Fallback to the third table if we found nothing and it exists
  if (!featuresText && tables.length >= 3) {
    featuresText = tables[2]!.textContent.toLowerCase();
  }

  // Strategy 3: Check the section under "Merkmale" header
  if (!featuresText) {
    const merkmaleHeader = root
      .querySelectorAll("h2, h3")
      .find((h) => h.textContent.includes("Merkmale"));
    if (merkmaleHeader) {
      featuresText =
        merkmaleHeader.nextElementSibling?.textContent.toLowerCase() || "";
    }
  }

  if (!featuresText) return features;

  features.hasBalcony =
    featuresText.includes("balkon") ||
    featuresText.includes("terrasse") ||
    featuresText.includes("loggia");
  features.hasElevator =
    featuresText.includes("aufzug") || featuresText.includes("fahrstuhl");
  features.hasBathtub = featuresText.includes("badewanne");
  features.hasShower = featuresText.includes("dusche");
  features.hasKitchen =
    featuresText.includes("küche") || featuresText.includes("einbauküche");
  features.isBarrierFree =
    featuresText.includes("barrierefrei") ||
    featuresText.includes("rollstuhl") ||
    featuresText.includes("barrierearm");

  if (
    featuresText.includes("fernheizung") ||
    featuresText.includes("zentralheizung") ||
    featuresText.includes("fernwärme")
  ) {
    features.heatingType = "Fernheizung/Zentralheizung";
  }

  return features;
}

/**
 * Extract description texts
 */
function extractDescriptions(root: HTMLElement) {
  const descriptions: {
    description?: string;
    locationDescription?: string;
  } = {};

  const h3s = root.querySelectorAll("h3");

  // Find description sections
  const objectDescSection = h3s.find((h) =>
    h.textContent.includes("Objektbeschreibung"),
  );
  if (objectDescSection) {
    const nextP = objectDescSection.nextElementSibling;
    if (nextP && nextP.tagName === "P") {
      descriptions.description = nextP.textContent.trim();
    }
  }

  const locationSection = h3s.find((h) => h.textContent.includes("Lage"));
  if (locationSection) {
    const nextP = locationSection.nextElementSibling;
    if (nextP && nextP.tagName === "P") {
      descriptions.locationDescription = nextP.textContent.trim();
    }
  }

  return descriptions;
}

function extractFloorPlan(root: HTMLElement) {
  const floorPlan = root.querySelector(".media-plan img");
  return floorPlan?.getAttribute("src");
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
