import { type HTMLElement, parse } from "node-html-parser";
import { parseNumberString } from "~/lib/parser";
import type { PropertyManagement, ScrapedFlat } from "../schemas";
import { propertyManagementConfigs } from "./configs";

const BASE_URL = "https://www.degewo.de";

export const degewo = {
  ...propertyManagementConfigs.degewo,
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls(): Promise<string[]> {
  const extractFlatUrlsFromPage = (root: HTMLElement) => {
    return Array.from(root.querySelectorAll(".c-teaser--apartment"))
      .map((teaser) =>
        teaser
          .querySelector('a[href^="/immosuche/detail"]')
          ?.getAttribute("href"),
      )
      .filter((href): href is string => Boolean(href));
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

  return [...new Set(flatUrls)].map((url) => `${BASE_URL}${url}`);
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  const getDlValue = (termLabel: string): string => {
    for (const item of root.querySelectorAll(".c-definition-list__item")) {
      const dt = item.querySelector("dt");
      if (dt?.text.trim() === termLabel) {
        return item.querySelector("dd")?.text.trim() ?? "";
      }
    }
    return "";
  };

  const rows = root.querySelectorAll("table tr");
  const getTableValue = (label: string): string => {
    const row = rows.find((row) => {
      const cells = row.querySelectorAll("td");
      return cells[0]?.text.includes(label);
    });
    const cells = row?.querySelectorAll("td");
    return cells?.[1]?.text.trim() || "";
  };

  // Extract basic information
  const title = root.querySelector("h1")?.text.trim() || "";
  const mapHeadline =
    root.querySelector("#section-map-rent-details h3")?.text.trim() ?? "";
  const addressFromMap = mapHeadline.replace(/^Adresse:\s*/i, "").trim();
  const addressLegacy =
    root.querySelector(".expose__meta")?.text.replace("|", "").trim() ?? "";
  const address = addressFromMap || addressLegacy;

  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  if (!address) {
    throw new Error(`Address not found for flat ${href}`);
  }

  // Extract pricing information (definition lists + legacy list/table)
  let coldRent = parseNumberString(getDlValue("Nettokaltmiete"));
  if (coldRent == null || Number.isNaN(coldRent) || coldRent < 0) {
    const priceItems = root.querySelectorAll("li");
    const coldRentText = priceItems.find((item) =>
      item.text.includes("Nettokaltmiete"),
    )?.text;
    coldRent = parseNumberString(coldRentText?.split(":")[1]?.trim());
  }

  if (!coldRent || Number.isNaN(coldRent) || coldRent < 0) {
    throw new Error(`Cold rent not found for flat ${href}`);
  }

  const warmFromInfoBox = root.querySelector(
    ".c-info-box__content-item--total dt.c-definition-list__term",
  )?.text;
  const warmRentText =
    warmFromInfoBox?.trim() || root.querySelector(".expose__price-tag")?.text;
  const warmRent = parseNumberString(
    warmRentText?.replace("€", "").replace("Gesamt", "").trim(),
  );

  const wohnflaecheRaw =
    getDlValue("Wohnfläche") || getTableValue("Wohnfläche");
  const area = parseNumberString(wohnflaecheRaw.replace(/m²/g, "").trim());

  const zimmerRaw = getDlValue("Zimmer") || getTableValue("Zimmer");
  const rooms = parseNumberString(zimmerRaw);

  const etageRaw =
    getDlValue("Etage") || getTableValue("Etage / Anzahl Etagen");
  const floorPart = etageRaw.split(/\s+von\s+|\//)[0]?.trim();
  const floorParsed = floorPart ? parseInt(floorPart, 10) : NaN;
  const floor = Number.isFinite(floorParsed) ? floorParsed : undefined;

  // Main gallery image (swiper) or legacy figure
  let imageUrl: string | undefined;
  const imgElement =
    root.querySelector(".c-swiper--immo-detail .c-swiper__slide--main img") ||
    root.querySelector("figure.gallery__main-image img");
  if (imgElement) {
    const src = imgElement.getAttribute("src")?.trim();
    if (src?.startsWith("/")) {
      imageUrl = `${BASE_URL}${src}`;
    } else if (src?.startsWith("http")) {
      imageUrl = src;
    }
    const srcset = imgElement.getAttribute("srcset");
    if (!imageUrl && srcset) {
      const srcsetParts = srcset.split(",").map((s) => s.trim());
      const images = srcsetParts
        .map((part) => {
          const [url, width] = part.split(" ");
          return { url: url?.trim(), width: parseInt(width || "0") || 0 };
        })
        .filter((img) => img.url);
      images.sort((a, b) => b.width - a.width);
      if (images.length > 0 && images[0]?.url?.startsWith("/")) {
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
    usableArea: area,
    roomCount: rooms,
    floor,
    imageUrl,
  } satisfies ScrapedFlat;
}
