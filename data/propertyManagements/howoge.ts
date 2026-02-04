import { parse } from "node-html-parser";
import { z } from "zod";

import { getApartmentTags } from "../tags";
import {
  scrapedFlatSchema,
  type PropertyManagement,
  type ScrapedFlat,
} from "../schemas";
import { fetchJson } from "~/lib/http";
import { parseNumberString, parseNumberStringToInt } from "~/lib/parser";

const howogeUrl = "https://www.howoge.de";

export const howoge = {
  slug: "howoge",
  name: "Howoge",
  website: "https://www.howoge.de",
  extractUrls,
  extractDataFromHtml,
} as const satisfies PropertyManagement;

async function extractUrls() {
  const json = await fetchJson(
    "https://www.howoge.de/?type=999&tx_howrealestate_json_list[action]=immoList",
  );
  const parsed = z
    .object({
      immoobjects: z.array(
        z.object({
          link: z.string(),
        }),
      ),
    })
    .safeParse(json);

  if (!parsed.success) {
    throw new Error(`Failed to parse JSON: ${parsed.error}`);
  }

  return parsed.data.immoobjects.map(
    (immoobject) => howogeUrl + immoobject.link,
  );
}

function extractDataFromHtml(html: string, href: string) {
  const root = parse(html);

  const title = root.querySelector(".data .title")?.textContent.trim();
  if (!title) {
    throw new Error(`Title not found for flat ${href}`);
  }

  // Extract basic information from dl.params
  const getParamValue = (label: string): string | undefined => {
    const divs = root.querySelectorAll(".data .params > div");
    for (const div of divs) {
      const dt = div.querySelector("dt")?.textContent.trim();
      if (dt === label) {
        return div.querySelector("dd")?.textContent.trim();
      }
    }
    return undefined;
  };

  const address = root
    .querySelector(".address-wrap .address")
    ?.textContent.trim();
  if (!address) {
    throw new Error(`Address not found for flat ${href}`);
  }

  // Extract from params
  const areaText = getParamValue("Wohnfläche")?.replace("m²", "").trim();
  const area = parseNumberString(areaText);

  const roomsText = getParamValue("Zimmer")?.trim();
  const rooms = parseNumberString(roomsText);

  const warmRentText = getParamValue("Warmmiete")?.replace("€", "").trim();
  const warmRent = parseNumberString(warmRentText);

  // Extract pricing information from "Mietkosten" table
  const getTrValue = (label: string, startIdx = 0): string | undefined => {
    const rows = root.querySelectorAll("table tbody tr");
    for (let i = startIdx; i < rows.length; i++) {
      const th = rows[i]?.querySelector("th");
      const td = rows[i]?.querySelector("td");
      if (th?.textContent.includes(label) && td) {
        return td.textContent.trim().replace("€", "").trim();
      }
    }
    return undefined;
  };

  const coldRentText = getTrValue("Kaltmiete:");
  const coldRent = parseNumberString(coldRentText);
  if (!coldRent || isNaN(coldRent) || coldRent < 0) {
    throw new Error(`Invalid cold rent: ${coldRentText}`);
  }

  // Extract floor information from Objektdetails table
  const getTrValueByLabel = (label: string): string | undefined => {
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

  const floorText = getTrValueByLabel("Etage:");
  const floor = parseNumberStringToInt(floorText);

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
    imageUrl: undefined,
  } satisfies ScrapedFlat;
}
