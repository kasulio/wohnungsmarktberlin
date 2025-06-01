import type { Browser } from "puppeteer-core";
import {
  flatSchema,
  type Flat,
  type PropertyManagement,
} from "../propertyManagementList";
import { getAddress } from "../address";
import { getApartmentTagsLocally } from "../tags";
import { parseUncleanFloat, parseUncleanInt } from "~/utils/util";
import { hashString } from "~/server/util";
import { getApartmentTagsViaAI } from "~/server/aiTagRetriever";
import { env } from "~/env";

export const gewobag: PropertyManagement = {
  slug: "gewobag",
  name: "Gewobag",
  website: "https://www.gewobag.de/",
  getFlats: async (browser: Browser) => {
    const url =
      "https://www.gewobag.de/fuer-mieter-und-mietinteressenten/mietangebote/?bezirke_all=1&objekttyp%5B%5D=wohnung&gesamtmiete_von=&gesamtmiete_bis=&gesamtflaeche_von=&gesamtflaeche_bis=&zimmer_von=&zimmer_bis=&sort-by=recent";
    const page = await browser.newPage();
    await page.goto(url);

    try {
      await page
        .waitForSelector("#CookieBoxSaveButton", {
          timeout: 300,
        })
        .then(() => page.click("#CookieBoxSaveButton"));
    } catch (e) {
      console.log("no cookie banner");
    }

    const readPage = async () => {
      const isEmpty = await Promise.race([
        page.waitForSelector(".empty-mietangebote"),
        page.waitForSelector(".site-footer"),
      ]).then((el) =>
        el?.evaluate((el) => el.classList.contains("empty-mietangebote")),
      );
      if (isEmpty) return [];

      const els = await page.$$("article.angebot-big-layout");

      return await Promise.all(
        els.map(async (el) => {
          const title = await el.$eval(
            ".angebot-title",
            (htmlTitle) => htmlTitle.textContent?.trim() ?? "",
          );
          const idSource = await el.$eval(
            ".read-more-link",
            (link) => (link as HTMLAnchorElement).href,
          );
          const addressRaw = await el.$eval(
            "address",
            (addressEl) => addressEl.textContent,
          );
          const availSpaceText = await el.$eval(
            ".angebot-area td",
            (spaceEl) => spaceEl.textContent,
          ); // <td> 1 Zimmer | 47,99 m² </td>
          const availSpace = availSpaceText ? availSpaceText.split("|") : [];
          const rooms = availSpace[0]?.trim() ?? "";
          const usableArea = availSpace[1]?.trim() ?? "";
          const warmRentPriceText = await el.$eval(
            ".angebot-kosten td",
            (rentText) => rentText.textContent,
          );
          const warmRentPrice = warmRentPriceText
            ? warmRentPriceText.substring(3) // ab 841,75€
            : "";

          const imageEl = await el.$("img[alt='Hausansicht");
          const imageUrl = imageEl
            ? await imageEl.evaluate((img) => img.src)
            : await el.$eval("img", (img) => img.src);

          if (!addressRaw) {
            return false;
          }
          const id = await hashString(idSource);
          const addressPretty = await getAddress(id, addressRaw);

          if (!addressPretty || !warmRentPrice || !title) {
            return false;
          }

          const returnFlat = {
            address: addressPretty,
            title,
            id,
            roomCount: parseUncleanInt(rooms),
            coldRentPrice: null, // nicht auf der Übersichtsseite verfügbar. wenn dann jede angebotsseite aufrufen...
            warmRentPrice: parseUncleanInt(warmRentPrice),
            usableArea: parseUncleanFloat(usableArea),
            tags: env.OPENAI_API_KEY
              ? await getApartmentTagsViaAI(id, title)
              : getApartmentTagsLocally(title),
            url: idSource,
            imageUrl,
          } satisfies Flat;
          const result = flatSchema.safeParse(returnFlat);
          if (result.success) {
            return result.data;
          }
          return false;
        }),
      );
    };

    const pagesData = await readPage();

    await page.close();
    return pagesData;
  },
};
