import { describe, expect, test } from "bun:test";
import {
  isCommercialByTitle,
  isParkingByTitle,
  shouldIgnoreListing,
  type FlatForIgnoreCheck,
} from "./flat-utils";

describe("shouldIgnoreListing", () => {
  const cases: { name: string; flat: FlatForIgnoreCheck; want: boolean }[] = [
    {
      name: "deuwo commercial zero-room",
      flat: {
        title: "Großzügige Gewerbeeinheit mit flexibler Nutzung",
        propertyManagementId: "deuwo",
        roomCount: 0,
      },
      want: true,
    },
    {
      name: "vonovia parking zero-room",
      flat: {
        title: "GÖNN DEINEM AUTO EIN ZUHAUSE!!!",
        propertyManagementId: "vonovia",
        roomCount: 0,
        coldRentPrice: 104,
      },
      want: true,
    },
    {
      name: "gewobag WBS zero-room stays visible",
      flat: {
        title:
          "Neubauwohnung im Erstbezug mit Fußbodenheizung und Balkon / WBS 220 erforderlich",
        propertyManagementId: "gewobag",
        roomCount: 0,
      },
      want: false,
    },
    {
      name: "apartment with included parking",
      flat: {
        title: "Schöne Wohnung mit Stellplatz",
        propertyManagementId: "degewo",
        roomCount: 3,
      },
      want: false,
    },
    {
      name: "commercial title on non-deuvono",
      flat: {
        title: "Attraktive Gewerbefläche in Mitte",
        propertyManagementId: "howoge",
        roomCount: 2,
      },
      want: true,
    },
    {
      name: "deuwo residential with rooms",
      flat: {
        title: "Familienwohnung im Grünen!",
        propertyManagementId: "deuwo",
        roomCount: 3,
      },
      want: false,
    },
    {
      name: "deuvono cheap listing",
      flat: {
        title: "Stellplatz",
        propertyManagementId: "deuwo",
        roomCount: 1,
        coldRentPrice: 80,
      },
      want: true,
    },
    {
      name: "commercial title on deuwo with rooms falls through to title rules",
      flat: {
        title: "Attraktive Gewerbefläche in Mitte",
        propertyManagementId: "deuwo",
        roomCount: 3,
        coldRentPrice: 800,
      },
      want: true,
    },
    {
      name: "null propertyManagementId skips provider rules",
      flat: {
        title: "Familienwohnung im Grünen!",
        propertyManagementId: null,
        roomCount: 0,
      },
      want: false,
    },
    {
      name: "neutral commercial marketing copy deuwo",
      flat: {
        title:
          "Ihr neuer Standort mit hoher Sichtbarkeit - Stark frequentiert im beliebten Szeneviertel",
        propertyManagementId: "deuwo",
        roomCount: 0,
      },
      want: true,
    },
  ];

  for (const { name, flat, want } of cases) {
    test(name, () => {
      expect(shouldIgnoreListing(flat)).toBe(want);
    });
  }
});

describe("isParkingByTitle", () => {
  test("standalone stellplatz", () => {
    expect(isParkingByTitle("TG-Stellplatz")).toBe(true);
  });

  test("wohnung mit stellplatz", () => {
    expect(isParkingByTitle("3-Zimmer Wohnung mit Stellplatz")).toBe(false);
  });
});

describe("isCommercialByTitle", () => {
  test("büro keyword", () => {
    expect(isCommercialByTitle("kleines Büro für administrative Zwecke")).toBe(
      true,
    );
  });

  test("residential title", () => {
    expect(isCommercialByTitle("Helle 2-Zimmer-Wohnung")).toBe(false);
  });
});
