import { type HTMLElement, parse } from "node-html-parser";
import { parseNumberString } from "~/lib/parser";
import { fetchHtml } from "~/lib/http";
import type { PropertyManagement, ScrapedFlat } from "../schemas";
import { propertyManagementConfigs } from "./configs";

const BASE_URL = "https://www.gesobau.de";
const LISTING_URL = `${BASE_URL}/mieten/wohnungssuche/`;
const DETAIL_PATH = "/mieten/wohnungssuche/detailseite/";
const MAX_PAGES = 20;

export const gesobau = {
  ...propertyManagementConfigs.gesobau,
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls(): Promise<string[]> {
  const flatUrls = new Set<string>();

  // Pages past the last one render an empty result list. The search page also
  // shows new-build and senior housing teasers that link to project pages
  // instead of a detail page; only detail links are listings.
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchHtml(`${LISTING_URL}?tx_solr%5Bpage%5D=${page}`);
    const hrefs = parse(html)
      .querySelectorAll(`a[href^="${DETAIL_PATH}"]`)
      .map((a) => a.getAttribute("href"))
      .filter((href): href is string => Boolean(href));
    if (hrefs.length === 0) break;
    for (const href of hrefs) flatUrls.add(`${BASE_URL}${href}`);
  }

  return [...flatUrls];
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  const title = root.querySelector("h1.immoHero__title")?.text.trim();
  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  const addressText = root
    .querySelector(".immoHero__address")
    ?.text.replace(/\s+/g, " ")
    .trim();
  if (!addressText) {
    throw new Error(`Address not found for flat ${href}`);
  }

  const coldRentPrice = parseNumberString(getCost(root, "Kaltmiete"));
  if (!coldRentPrice || coldRentPrice <= 0) {
    throw new Error(`Cold rent not found for flat ${href}`);
  }

  const imageHref = root
    .querySelector(".immoHero__image-slider a.gallery--lightbox")
    ?.getAttribute("href");

  return {
    title,
    coldRentPrice,
    warmRentPrice: parseNumberString(getCost(root, "Miete inkl. NK")),
    url: href,
    addressText,
    roomCount: parseNumberString(getDetail(root, "Anzahl Zimmer")),
    usableArea: parseNumberString(getDetail(root, "Wohnfläche")),
    floor: parseFloor(getDetail(root, "Etage")),
    imageUrl: imageHref?.startsWith("/")
      ? `${BASE_URL}${imageHref}`
      : imageHref,
  } satisfies ScrapedFlat;
}

/** "Kosten" table: `<th>Kaltmiete:</th><td>857,77 €</td>`. */
function getCost(root: HTMLElement, label: string): string | undefined {
  for (const th of root.querySelectorAll(".immoMainContent__table th")) {
    if (th.text.trim().replace(/:$/, "") === label) {
      return th.nextElementSibling?.text.replace("€", "").trim();
    }
  }
  return undefined;
}

/** Sidebar list: `<li>Wohnfläche: 42,91 m²</li>`. */
function getDetail(root: HTMLElement, label: string): string | undefined {
  for (const li of root.querySelectorAll(".immoSidebar__keyfacts li")) {
    const [key, ...rest] = li.text.replace(/\s+/g, " ").split(":");
    if (key?.trim() === label) return rest.join(":").trim();
  }
  return undefined;
}

/** Observed values: "EG", "1", "6". */
function parseFloor(text: string | undefined): number | undefined {
  if (!text) return undefined;
  if (text.toUpperCase() === "EG") return 0;
  const floor = parseInt(text, 10);
  return Number.isFinite(floor) ? floor : undefined;
}
