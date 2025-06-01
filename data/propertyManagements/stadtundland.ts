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
import { typedObjectKeys } from "~/utils/typeHelper";
import { getApartmentTagsViaAI } from "~/server/aiTagRetriever";
import { env } from "~/env";

export const stadtundland: PropertyManagement = {
  slug: "stadtundland",
  name: "Stadt und Land",
  website: "https://www.stadtundland.de/",
  getFlats: async (browser: Browser) => {
    const url = "https://www.stadtundland.de/immobiliensuche.php";
    const page = await browser.newPage();
    await page.goto(url);

    try {
      await page
        .waitForSelector(".SP-ConsentBanner__button--onlyNecessary", {
          timeout: 300,
        })
        .then(() => page.click(".SP-ConsentBanner__button--onlyNecessary"));
    } catch (e) {
      console.log("no cookie banner");
    }

    await page.waitForSelector("#button-submit-gen-2");
    await page.click("#button-submit-gen-2");

    const readPage = async () => {
      await page.waitForSelector(".SP-TeaserList__item");
      const els = await page.$$(".SP-TeaserList__item");
      const tableKeyMap = {
        adresse: "address",
        nutzfl: "usableArea",
        wohnfl: "usableArea",
        kaltmiete: "coldRentPrice",
        warmmiete: "warmRentPrice",
        "zzgl. gültiger ust": "coldRentPrice",
        zimmer: "roomCount",
      } as const;
      const tableKeys = typedObjectKeys(tableKeyMap);
      return await Promise.all(
        els.map(async (el) => {
          const title = await el.$eval(
            ".SP-Teaser__headline",
            (el) => el.textContent?.trim() ?? "",
          );
          const imageUrl =
            (await el.$(".SP-MiniGallery__list a")) === null
              ? null
              : await el.$eval(".SP-MiniGallery__list a", (el) => el.href);

          const idSource = await el.$eval(
            ".SP-LinkList__item a",
            (el) => el.href,
          );
          const id = await hashString(idSource);

          const tableData = await el.$eval(".SP-Table--static tbody", (el) => {
            return Array.from(el.children).reduce(
              (acc, cur) => {
                const key =
                  cur.children[0].textContent?.toLowerCase().trim() ?? "";
                const value =
                  cur.children[1].textContent?.toLowerCase().trim() ?? "";
                acc[key] = value;
                return acc;
              },
              {} as Record<string, string>,
            );
          });

          const mappedTableData = Object.entries(tableData).reduce(
            (acc, [key, value]) => {
              // if one element in tablekeys is part of the key, we map it to the new key
              const mappedKey = tableKeys.find((tableKey) =>
                key.includes(tableKey),
              );
              if (mappedKey) {
                acc[tableKeyMap[mappedKey]] = value;
              }
              return acc;
            },
            {} as Record<
              (typeof tableKeyMap)[keyof typeof tableKeyMap],
              string
            >,
          );

          const address = await getAddress(id, mappedTableData.address);
          const coldRentPrice = parseUncleanInt(mappedTableData.coldRentPrice);
          if (!address || !coldRentPrice || !title) {
            return false;
          }

          const returnFlat = {
            address,
            title,
            id,
            roomCount: parseUncleanInt(mappedTableData.roomCount),
            coldRentPrice,
            warmRentPrice: parseUncleanInt(mappedTableData.warmRentPrice),
            usableArea: parseUncleanFloat(mappedTableData.usableArea),
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

    let paginationNextButton = await page.$(".SP-Paging__button--next");
    while (paginationNextButton) {
      await paginationNextButton.click();
      await page.waitForNetworkIdle();
      const newPageData = await readPage();
      pagesData.push(...newPageData);
      paginationNextButton = await page.$(".SP-Paging__button--next");
    }

    await page.close();
    return pagesData;
  },
};
