import { parse, type HTMLElement } from "node-html-parser";

import { getApartmentTags } from "../tags";
import {
  scrapedFlatSchema,
  type PropertyManagement,
  type ScrapedFlat,
} from "../schemas";
import { parseNumberString } from "~/lib/parser";

const BASE_URL = "https://www.degewo.de";

export const degewo = {
  slug: "degewo",
  name: "Degewo",
  website: "https://www.degewo.de",
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls(): Promise<string[]> {
  const extractFlatUrlsFromPage = (root: HTMLElement) => {
    const urls = Array.from(
      root.querySelectorAll(".article-list__item--immosearch a"),
    )
      .map((a) => a.getAttribute("href"))
      .filter(Boolean);
    return urls;
  };

  let page = 1;
  const formData = new FormData();
  formData.append("tx_openimmo_immobilie[search]", "paginate");
  formData.append("tx_openimmo_immobilie[page]", page.toString());

  const html = await fetch(`${BASE_URL}/immosuche`, {
    method: "POST",
    body: formData,
  }).then((res) => res.text());

  const root = parse(html);
  const flatUrls = extractFlatUrlsFromPage(root);

  while (page < 10) {
    try {
      formData.set("tx_openimmo_immobilie[page]", (++page).toString());
      const newHtml = await fetch(`${BASE_URL}/immosuche`, {
        method: "POST",
        body: formData,
      }).then((res) => res.text());

      const newRoot = parse(newHtml);
      const newFlatUrls = extractFlatUrlsFromPage(newRoot);
      if (newFlatUrls.length === 0) break;
      flatUrls.push(...newFlatUrls);
    } catch (error) {
      console.error(error);
      break;
    }
  }

  return flatUrls.map((url) => `${BASE_URL}${url}`);
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  // Extract basic information
  const title = root.querySelector("h1")?.text.trim() || "";
  const address =
    root.querySelector(".expose__meta")?.text.replace("|", "").trim() || "";

  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  if (!address) {
    throw new Error(`Address not found for flat ${href}`);
  }

  // Extract pricing information
  const priceItems = root.querySelectorAll("li");
  const coldRentText = priceItems.find((item) =>
    item.text.includes("Nettokaltmiete"),
  )?.text;
  const coldRent = parseNumberString(coldRentText?.split(":")[1]?.trim());

  if (!coldRent || isNaN(coldRent) || coldRent < 0) {
    throw new Error(`Cold rent not found for flat ${href}`);
  }

  const warmRentText = root.querySelector(".expose__price-tag")?.text;
  const warmRent = parseNumberString(
    warmRentText?.replace("€", "").replace("Gesamt", "").trim(),
  );

  // Extract property details from the table
  const rows = root.querySelectorAll("table tr");
  const getTableValue = (label: string): string => {
    const row = rows.find((row) => {
      const cells = row.querySelectorAll("td");
      return cells[0]?.text.includes(label);
    });
    const cells = row?.querySelectorAll("td");
    return cells?.[1]?.text.trim() || "";
  };

  const area = parseNumberString(getTableValue("Wohnfläche").replace("m²", ""));
  const rooms = parseNumberString(getTableValue("Zimmer"));
  const floorInfo = getTableValue("Etage / Anzahl Etagen").split("/");
  const floor = floorInfo[0] ? parseInt(floorInfo[0].trim()) : undefined;

  // Extract image URL from img srcset attribute (select largest image)
  const imgElement = root.querySelector("figure.gallery__main-image img");
  let imageUrl: string | undefined;
  if (imgElement) {
    const srcset = imgElement.getAttribute("srcset");
    if (srcset) {
      // Parse srcset to get the largest image
      const srcsetParts = srcset.split(",").map((s) => s.trim());
      const images = srcsetParts
        .map((part) => {
          const [url, width] = part.split(" ");
          return { url: url?.trim(), width: parseInt(width || "0") || 0 };
        })
        .filter((img) => img.url); // Filter out undefined urls
      // Sort by width descending and take the largest
      images.sort((a, b) => b.width - a.width);
      if (images.length > 0 && images[0]?.url) {
        imageUrl = `${BASE_URL}${images[0].url}`;
      }
    }
  }

  return {
    title,
    coldRentPrice: coldRent,
    warmRentPrice: warmRent,
    url: href,
    addressText: address,
    usableArea: area ?? 0,
    roomCount: rooms ?? 0,
    floor,
    tags: getApartmentTags(title),
    imageUrl,
  } satisfies ScrapedFlat;
}
