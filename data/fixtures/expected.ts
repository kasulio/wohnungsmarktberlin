import type { ScrapedFlat } from "~/data/schemas";

type ExpectedFlat = {
  slug: string;
} & Pick<
  ScrapedFlat,
  | "title"
  | "coldRentPrice"
  | "warmRentPrice"
  | "roomCount"
  | "usableArea"
  | "addressText"
  | "floor"
  | "imageUrl"
>;

export const expectedValues: Record<string, ExpectedFlat> = {
  "berlinovo--standard-listing.html": {
    slug: "berlinovo",
    title: "2 Zimmer, H1.02.13",
    coldRentPrice: 532.84,
    warmRentPrice: 741.79,
    roomCount: 2,
    usableArea: 37.87,
    addressText: "Dröpkeweg 11\n\n12349 Berlin\n\nDeutschland",
    floor: 2,
    imageUrl:
      "https://www.berlinovo.de/sites/default/files/styles/object_details_main/public/images/wohnungen/berlinovo_bb04be35-b0ab-426e-82c1-72d1adfd3a9d.jpg?itok=0Fi4R6s6",
  },
  "degewo--standard-listing.html": {
    slug: "degewo",
    title: "1-Zimmerwohnung in Köpenick - Nachmieter gesucht!",
    coldRentPrice: 819.36,
    warmRentPrice: 946.35,
    roomCount: 1,
    usableArea: 45.52,
    addressText: "Zur Nachtheide 4, 12557 Berlin",
    floor: 5,
    imageUrl:
      "https://www.degewo.de/fileadmin/user_upload/tx_openimmo/_processed_/0/d/csm_630-degewo_dd5aa8dc-4c64-4dc4-9e5b-14fe31b7ad5f_617bf5ceaf.jpg",
  },
  "deuwo--standard-listing.html": {
    slug: "deuwo",
    title: "Exklusive Neubauwohnung mit hochwertiger Ausstattung!",
    coldRentPrice: 1479.67,
    warmRentPrice: 1779.35,
    roomCount: 3,
    usableArea: 74.92,
    addressText: "Hildegardstr. 5A",
    floor: 1,
    imageUrl:
      "https://cdn.expose.vonovia.de/VNA-b6260a24-51cf-48d8-9ccd-8c6912a01306.jpg?width=538&crop=3:2",
  },
  "gewobag--standard-listing.html": {
    slug: "gewobag",
    title:
      "Neubauwohnung an der Waaterkant mit Fußbodenheizung und Balkon / WBS 220",
    coldRentPrice: 1008.67,
    warmRentPrice: 1447.23,
    roomCount: 4,
    usableArea: 87.71,
    addressText: "Daumstr. 64, 13599 Berlin",
    floor: 2,
    imageUrl:
      "https://www.gewobag.de/wp-content/uploads/gewo-immo-media/0100-01036-0802-0347/gewobag_2cecb50f-2aff-4284-93b8-263d68327c2d.jpg",
  },
  "howoge--standard-listing.html": {
    slug: "howoge",
    title: "3-Zimmer-Wohnung (WBS 100-140)",
    coldRentPrice: 511,
    warmRentPrice: 803,
    roomCount: 3,
    usableArea: 73,
    addressText:
      "Adresse:\n\n                        Streitstraße 5,\n\n                        13587 Berlin, Hakenfelde",
    floor: 3,
    imageUrl:
      "https://www.howoge.de/fileadmin/_processed_/6/d/xcsm_3de75f489497a4d71e748f9225a4b828_3798beaef2.webp.pagespeed.ic.StVjtmNdIC.webp",
  },
  "stadtundland--standard-listing.html": {
    slug: "stadtundland",
    title: "3 Zimmer / 80,26 m² – Zweitvermietung im Neubau",
    coldRentPrice: 1386.97,
    warmRentPrice: 1613.97,
    roomCount: 3,
    usableArea: 80.26,
    addressText: "Sterndamm 80, 12487 Berlin",
    floor: 3,
    imageUrl:
      "https://d2396ha8oiavw0.cloudfront.net/wohnungshelden/stadt_und_land_Bildimport1-2024-06-07_STADTUNDLAND_1001_WE_5127_GE_03_MO_00044_IMG_5902.JPG.jpg",
  },
  "vonovia--standard-listing.html": {
    slug: "vonovia",
    title:
      "Lichtdurchflutetes Dachgeschoss: Moderne 2-Zimmer-Wohnung mit zwei Balkonen in Mariendorf",
    coldRentPrice: 1162.41,
    warmRentPrice: 1347.41,
    roomCount: 2,
    usableArea: 56.56,
    addressText: "Rixdorfer Str. 68",
    imageUrl:
      "https://cdn.expose.vonovia.de/VNA-7939dea1-d555-414f-86d0-caaa084fa7e8.jpg?width=538&crop=3:2",
  },
};
