import type { Browser } from "puppeteer-core";
import ky from "ky";
import { parse } from "node-html-parser";
import type { PropertyManagement, Flat } from "../propertyManagementList";
import { flatSchema } from "../propertyManagementList";
import { getAddress } from "../address";
import { hashString } from "~/server/util";
import { getApartmentTagsLocally } from "../tags";
import { getApartmentTagsViaAI } from "~/server/aiTagRetriever";
import { env } from "~/env";
import { parseGermanNumberString, cleanAddress } from "../shared/utils";

export const gewobag: PropertyManagement = {
  slug: "gewobag",
  name: "Gewobag",
  website: "https://www.gewobag.de/",
  getFlats: async () => {
    const url =
      "https://www.gewobag.de/fuer-mieter-und-mietinteressenten/mietangebote/?bezirke_all=1&objekttyp%5B%5D=wohnung&gesamtmiete_von=&gesamtmiete_bis=&gesamtflaeche_von=&gesamtflaeche_bis=&zimmer_von=&zimmer_bis=&sort-by=recent";

    try {
      const response = await ky.get(url);
      const html = await response.text();
      const root = parse(html);

      const listings = root.querySelectorAll("article.angebot-big-layout");

      const flats = await Promise.all(
        listings.map(async (listing) => {
          try {
            // Extract title and URL
            const titleEl = listing.querySelector(".angebot-title");
            const title = titleEl?.text?.trim() || "";

            const linkEl = listing.querySelector(".read-more-link");
            const url = linkEl?.getAttribute("href") || "";

            // Extract address
            const addressEl = listing.querySelector("address");
            const address = cleanAddress(addressEl?.text) || "";

            // Extract data from tables
            const areaCell = listing.querySelector(".angebot-area td");
            const areaText = areaCell?.text?.trim() || "";
            // Format: "1 Zimmer | 47,99 m²"
            const areaParts = areaText.split("|");

            const rooms = parseGermanNumberString(areaParts[0]);
            const area = parseGermanNumberString(areaParts[1]);

            const costCell = listing.querySelector(".angebot-kosten td");
            const costText = costCell?.text?.trim() || "";
            // Format: "ab 841,75€"
            const warmRent = parseGermanNumberString(costText);

            // Image
            const imageEl =
              listing.querySelector("img[alt='Hausansicht']") ||
              listing.querySelector("img");
            const imageUrl =
              imageEl?.getAttribute("src") ||
              imageEl?.getAttribute("data-src") ||
              null;

            if (!title || !url || !address) {
              return false;
            }

            const id = await hashString(url);
            const cleanedAddress = await getAddress(id, address);

            if (!cleanedAddress) {
              return false;
            }

            const tags = env.OPENAI_API_KEY
              ? await getApartmentTagsViaAI(id, title)
              : getApartmentTagsLocally(title);

            const flat = {
              id,
              title,
              coldRentPrice: null, // Cold rent not available on overview
              warmRentPrice: warmRent,
              roomCount: rooms,
              usableArea: area,
              address: cleanedAddress,
              floor: null,
              tags,
              imageUrl,
              url,
            } satisfies Flat;

            const result = flatSchema.safeParse(flat);
            return result.success ? result.data : false;
          } catch (error) {
            console.error("Error parsing Gewobag listing:", error);
            return false;
          }
        }),
      );

      return flats.filter((flat): flat is Flat => flat !== false);
    } catch (error) {
      console.error("Error scraping Gewobag:", error);
      return [];
    }
  },
};
