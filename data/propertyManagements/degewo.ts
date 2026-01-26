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

/**
 * Degewo scraper
 * Uses custom POST-based pagination
 */
export const degewo: PropertyManagement = {
  slug: "degewo",
  name: "degewo AG",
  website: "https://www.degewo.de/",
  getFlats: async () => {
    const baseUrl = "https://www.degewo.de/immosuche";
    const allFlats: (Flat | false)[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        // Make POST request to fetch page
        const formData = new URLSearchParams({
          "tx_openimmo_immobilie[search]": "paginate",
          "tx_openimmo_immobilie[page]": page.toString(),
        });

        const response = await ky.post(baseUrl, {
          body: formData,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const html = await response.text();
        const root = parse(html);

        // Parse listings from page
        const listings = root.querySelectorAll(
          ".immobilie-item, .object-item, article.property",
        );

        if (listings.length === 0) {
          hasMorePages = false;
          break;
        }

        // Process each listing
        const pageFlats = await Promise.all(
          listings.map(async (listing) => {
            try {
              // Extract title and URL
              const titleEl = listing.querySelector(
                "h2 a, h3 a, .title a, .property-title a",
              );
              const title = titleEl?.text?.trim() || "";
              const url = titleEl?.getAttribute("href") || "";
              const fullUrl = url.startsWith("http")
                ? url
                : `https://www.degewo.de${url}`;

              // Extract address
              const addressEl = listing.querySelector(
                ".address, .property-address, address",
              );
              const address = cleanAddress(addressEl?.text) || "";

              // Extract details from table or list
              const detailsEl = listing.querySelectorAll(
                ".details dd, .property-details dd, td",
              );
              const detailsText: string[] = [];
              detailsEl.forEach((el) => {
                const text = el.text?.trim();
                if (text) {
                  detailsText.push(text);
                }
              });

              // Try to extract structured data
              const allText = listing.text;

              // Extract room count
              let rooms: number | null = null;
              const roomMatch = allText.match(
                /(\d+[,.]?\d*)\s*(?:Zimmer|zimmer|Zi\.)/,
              );
              if (roomMatch) {
                rooms = parseGermanNumberString(roomMatch[1]);
              }

              // Extract area
              let area: number | null = null;
              const areaMatch = allText.match(/(\d+[,.]?\d*)\s*(?:m²|m2|qm)/i);
              if (areaMatch) {
                area = parseGermanNumberString(areaMatch[1]);
              }

              // Extract cold rent
              let coldRent: number | null = null;
              const coldRentMatch = allText.match(
                /Kaltmiete[\s:]*(\d+[,.]?\d*)/i,
              );
              if (coldRentMatch) {
                coldRent = parseGermanNumberString(coldRentMatch[1]);
              }

              // Extract warm rent
              let warmRent: number | null = null;
              const warmRentMatch = allText.match(
                /Gesamtmiete[\s:]*(\d+[,.]?\d*)/i,
              );
              if (warmRentMatch) {
                warmRent = parseGermanNumberString(warmRentMatch[1]);
              }

              // Extract image
              const imageEl = listing.querySelector("img");
              const imageUrl =
                imageEl?.getAttribute("src") ||
                imageEl?.getAttribute("data-src") ||
                null;
              const fullImageUrl =
                imageUrl && !imageUrl.startsWith("http")
                  ? `https://www.degewo.de${imageUrl}`
                  : imageUrl;

              if (!title || !fullUrl || !address) {
                return false;
              }

              // Generate ID
              const id = await hashString(fullUrl);

              // Get cleaned address with geocoding
              const cleanedAddress = await getAddress(id, address);
              if (!cleanedAddress) {
                return false;
              }

              // Get tags
              const tags = env.OPENAI_API_KEY
                ? await getApartmentTagsViaAI(id, title)
                : getApartmentTagsLocally(title);

              // Create flat object
              const flat = {
                id,
                title,
                coldRentPrice: coldRent,
                warmRentPrice: warmRent,
                roomCount: rooms,
                usableArea: area,
                address: cleanedAddress,
                floor: null,
                tags,
                imageUrl: fullImageUrl,
                url: fullUrl,
              } satisfies Flat;

              // Validate against schema
              const result = flatSchema.safeParse(flat);
              return result.success ? result.data : false;
            } catch (error) {
              console.error("Error processing Degewo listing:", error);
              return false;
            }
          }),
        );

        allFlats.push(...pageFlats);

        // Check if there are more pages (look for pagination)
        const nextButton = root.querySelector(
          ".pagination .next, .pagination a[rel='next']",
        );
        if (!nextButton || listings.length < 10) {
          hasMorePages = false;
        } else {
          page++;
          // Add delay between requests to be respectful
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error fetching Degewo page ${page}:`, error);
        hasMorePages = false;
      }
    }

    return allFlats;
  },
};
