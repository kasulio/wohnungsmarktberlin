import { type HTMLElement, parse } from "node-html-parser";
import { parseNumberString } from "~/lib/parser";
import type { PropertyManagement, ScrapedFlat } from "../schemas";
import { propertyManagementConfigs } from "./configs";

const BASE_URL = "https://www.wbm.de";
const LISTING_URL = `${BASE_URL}/wohnungen-berlin/angebote/`;

export const wbm = {
  ...propertyManagementConfigs.wbm,
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls(): Promise<string[]> {
  const extractFlatUrlsFromPage = (root: HTMLElement) =>
    Array.from(root.querySelectorAll(".openimmo-search-list-item"))
      .map((item) =>
        item
          .querySelector('a[href^="/wohnungen-berlin/angebote/details/"]')
          ?.getAttribute("href"),
      )
      .filter((href): href is string => Boolean(href));

  const fetchPage = async (page: number) => {
    const formData = new FormData();
    formData.append("tx_openimmo_immobilie[search]", "paginate");
    formData.append("tx_openimmo_immobilie[page]", page.toString());
    const html = await fetch(LISTING_URL, {
      method: "POST",
      body: formData,
    }).then((res) => res.text());
    return extractFlatUrlsFromPage(parse(html));
  };

  const flatUrls = new Set<string>(await fetchPage(1));

  // Same TYPO3 OpenImmo extension as degewo. When the page number exceeds
  // the result set, WBM re-serves page 1 instead of an empty list, so we stop
  // as soon as a page contributes nothing new.
  let page = 1;
  while (page < 10) {
    try {
      const sizeBefore = flatUrls.size;
      for (const url of await fetchPage(++page)) flatUrls.add(url);
      if (flatUrls.size === sizeBefore) break;
    } catch (error) {
      console.error(error);
      break;
    }
  }

  return [...flatUrls].map((url) => `${BASE_URL}${url}`);
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  const title = root.querySelector("h1.openimmo-detail__title")?.text.trim();
  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  const address = root
    .querySelector(".openimmo-detail__intro-address")
    ?.text.replace(/\s+/g, " ")
    .trim();
  if (!address) {
    throw new Error(`Address not found for flat ${href}`);
  }

  // "Mietkosten" list: <span title>Nettokaltmiete</span><span value>1.195,39 EUR</span>
  const getRentalCost = (label: string): string | undefined => {
    for (const item of root.querySelectorAll(
      ".openimmo-detail__rental-costs-list-item",
    )) {
      const itemTitle = item
        .querySelector(".openimmo-detail__rental-costs-list-item-title")
        ?.text.trim();
      if (itemTitle === label) {
        return item
          .querySelector(".openimmo-detail__rental-costs-list-item-value")
          ?.text.replace(/EUR|€/g, "")
          .trim();
      }
    }
    return undefined;
  };

  // "Objektdetails" list: <li><span>Anzahl der Zimmer:</span> 2</li>
  const getObjectDetail = (label: string): string | undefined => {
    for (const item of root.querySelectorAll(
      ".openimmo-detail__object-list-item",
    )) {
      const span = item.querySelector("span");
      if (span?.text.trim().replace(/:$/, "") === label) {
        return item.text.replace(span.text, "").replace(/\s+/g, " ").trim();
      }
    }
    return undefined;
  };

  const coldRent = parseNumberString(getRentalCost("Nettokaltmiete"));
  if (!coldRent || coldRent <= 0) {
    throw new Error(`Cold rent not found for flat ${href}`);
  }
  const warmRent = parseNumberString(getRentalCost("Warmmiete"));

  const rooms = parseNumberString(getObjectDetail("Anzahl der Zimmer"));

  // "ca. 65.56 m²" – WBM uses a period as decimal separator here
  const area = parseNumberString(
    getObjectDetail("Größe")
      ?.replace(/ca\.?/i, "")
      .replace(/m².*/, "")
      .trim(),
  );

  const floor = parseFloor(getObjectDetail("Etage"));

  const imgSrc =
    root
      .querySelector(".openimmo-detail__image-container img")
      ?.getAttribute("src") ??
    root
      .querySelector(".openimmo-detail__intro-image-container img")
      ?.getAttribute("src");
  let imageUrl: string | undefined;
  if (imgSrc?.startsWith("http")) {
    imageUrl = imgSrc;
  } else if (imgSrc?.startsWith("/")) {
    imageUrl = `${BASE_URL}${imgSrc}`;
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

/** Observed values: "EG", "DG", "1", "2". Dachgeschoss has no numeric floor. */
function parseFloor(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const normalized = text.trim().toUpperCase();
  if (normalized === "EG") return 0;
  if (normalized === "UG") return -1;
  const match = normalized.match(/^(-?\d+)/);
  if (!match) return undefined;
  const floor = parseInt(match[1]!, 10);
  return Number.isFinite(floor) ? floor : undefined;
}
