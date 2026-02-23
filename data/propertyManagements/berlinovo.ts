import { parse, type HTMLElement } from "node-html-parser";
import { getApartmentTags } from "../tags";
import { type PropertyManagement, type ScrapedFlat } from "../schemas";
import { fetchHtml } from "~/lib/http";
import { parseNumberString } from "~/lib/parser";
import { propertyManagementConfigs } from "./configs";

const BASE_URL = "https://www.berlinovo.de";

export const berlinovo = {
  ...propertyManagementConfigs.berlinovo,
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

// Helper function to extract text from a label and its next sibling
const extractLabelValue = (
  root: HTMLElement,
  labelText: string,
  selector = ".field__label",
): string => {
  return (
    Array.from(root.querySelectorAll(selector))
      .find((el) =>
        el.text.trim().toLowerCase().includes(labelText.toLowerCase()),
      )
      ?.nextElementSibling?.text.trim() ?? ""
  );
};

// Helper function to extract and parse a number from a label
const extractNumber = (
  root: HTMLElement,
  labelText: string,
  selector = ".field__label",
): number | undefined => {
  const text = extractLabelValue(root, labelText, selector);
  return parseNumberString(text);
};

function extractDataFromHtml(html: string, href: string): ScrapedFlat {
  const root = parse(html);

  // Extract basic information
  const title = root.querySelector("h1")?.text.trim() ?? "";

  // Extract pricing information
  const warmRent = extractNumber(root, "warmmiete");
  const coldRent = extractNumber(root, "kaltmiete");

  // Extract property details
  const area = extractNumber(root, "wohnfläche");
  const rooms = extractNumber(root, "zimmer");
  const floor = extractNumber(root, "etage");
  const address = extractLabelValue(root, "adresse");

  // Extract images
  const images = Array.from(root.querySelectorAll(".slick-wrapper img"))
    .map((img) => img.getAttribute("data-lazy"))
    .filter((src): src is string => {
      if (!src) return false;
      if (src.includes("logo") || src.includes("icon")) return false;
      return src.startsWith("http") || src.startsWith("/");
    })
    .map((src) => (src.startsWith("http") ? src : `${BASE_URL}${src}`));

  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  return {
    title,
    coldRentPrice: coldRent,
    warmRentPrice: warmRent,
    url: href,
    addressText: address ?? "",
    usableArea: area ?? 0,
    roomCount: rooms ?? 0,
    floor,
    tags: getApartmentTags(title),
    imageUrl: images[0] ?? undefined,
  };
}

async function extractUrls() {
  const extractFlatUrlsFromPage = (root: HTMLElement) => {
    const urls = Array.from(
      root.querySelectorAll(".node--type-apartment .title a"),
    )
      .map((a) => a.getAttribute("href"))
      .filter(Boolean);
    return urls;
  };

  const html = await fetchHtml(
    `${BASE_URL}/de/wohnungen/suche?w[0]=wohungen_region%3A6`,
  );
  const root = parse(html);

  const flatUrls = extractFlatUrlsFromPage(root);

  let nextPageUrl = root
    .querySelector(".pagination a[rel=next]")
    ?.getAttribute("href");

  while (nextPageUrl) {
    const nextPageHtml = await fetchHtml(`${BASE_URL}${nextPageUrl}`);
    const nextPageRoot = parse(nextPageHtml);

    const nextPageFlatUrls = extractFlatUrlsFromPage(nextPageRoot);
    flatUrls.push(...nextPageFlatUrls);

    nextPageUrl = nextPageRoot
      .querySelector(".pagination a[rel=next]")
      ?.getAttribute("href");
  }

  return flatUrls.map((url) => `${BASE_URL}${url}`);
}
