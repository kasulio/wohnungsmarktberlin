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
import { processWithQueue } from "../shared/queue";

export const berlinovo: PropertyManagement = {
  slug: "berlinovo",
  name: "berlinovo",
  website: "https://www.berlinovo.de/",
  getFlats: async (browser: Browser) => {
    const baseUrl = "https://www.berlinovo.de";
    const searchUrl = `${baseUrl}/de/wohnungen/suche`;
    const searchParams = new URLSearchParams({
      "w[0]": "wohungen_region:6", // Region Berlin
    });

    const allFlats: (Flat | false)[] = [];
    let page = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        if (page > 0) {
          searchParams.set("page", page.toString());
        }

        const response = await ky.get(searchUrl, {
          searchParams,
        });

        const html = await response.text();
        const root = parse(html);

        const listings = root.querySelectorAll("article.node--type-apartment");

        if (listings.length === 0) {
          hasMorePages = false;
          break;
        }

        // Extract URLs for detail pages
        const detailUrls = listings
          .map((listing) => {
            const linkEl = listing.querySelector(".title .field--name-title a");
            const url = linkEl?.getAttribute("href") || "";
            return url.startsWith("http") ? url : `${baseUrl}${url}`;
          })
          .filter((url) => url !== "" && url !== baseUrl);

        // Process detail pages with queue
        const pageFlats = await processWithQueue(
          detailUrls,
          async (url) => {
            try {
              const detailResponse = await ky.get(url);
              const detailHtml = await detailResponse.text();
              const detailRoot = parse(detailHtml);

              const titleEl = detailRoot.querySelector(
                ".title .field--name-title",
              );
              const title = titleEl?.text?.trim() || "";

              const addressEl = detailRoot.querySelector(".address");
              const address = cleanAddress(addressEl?.text) || "";

              // Extract key facts
              const roomsEl = detailRoot.querySelector(
                ".field--name-field-rooms .field__item",
              );
              const rooms = parseGermanNumberString(
                roomsEl?.getAttribute("content") || roomsEl?.text,
              );

              const areaEl = detailRoot.querySelector(
                ".field--name-field-area .field__item",
              );
              const area = parseGermanNumberString(areaEl?.text);

              const coldRentEl = detailRoot.querySelector(
                ".field--name-field-bruttokaltmiete .field__item",
              );
              const coldRent = parseGermanNumberString(
                coldRentEl?.getAttribute("content") || coldRentEl?.text,
              );

              const warmRentEl = detailRoot.querySelector(
                ".field--name-field-total-rent .field__item",
              );
              const warmRent = parseGermanNumberString(
                warmRentEl?.getAttribute("content") || warmRentEl?.text,
              );

              const floorEl = detailRoot.querySelector(
                ".field--name-field-floor .field__item",
              );
              const floor = parseGermanNumberString(floorEl?.text);

              // Image
              const imageEl = detailRoot.querySelector(
                ".block-field-blocknodeapartmentfield-image img",
              );
              const imageUrl = imageEl?.getAttribute("src") || null;
              const fullImageUrl =
                imageUrl && !imageUrl.startsWith("http")
                  ? `${baseUrl}${imageUrl}`
                  : imageUrl;

              if (!title || !address) {
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
                coldRentPrice: coldRent,
                warmRentPrice: warmRent,
                roomCount: rooms,
                usableArea: area,
                address: cleanedAddress,
                floor,
                tags,
                imageUrl: fullImageUrl,
                url,
              } satisfies Flat;

              const result = flatSchema.safeParse(flat);
              return result.success ? result.data : false;
            } catch (error) {
              console.error(
                `Error scraping Berlinovo detail page ${url}:`,
                error,
              );
              return false;
            }
          },
          { concurrency: 5, wait: 200 },
        );

        allFlats.push(...pageFlats);

        // Check for next page
        const nextButton = root.querySelector(".pager__item--next");
        if (!nextButton) {
          hasMorePages = false;
        } else {
          page++;
          // Be nice to the server
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error fetching Berlinovo page ${page}:`, error);
        hasMorePages = false;
      }
    }

    return allFlats;
  },
};
