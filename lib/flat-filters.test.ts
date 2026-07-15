import { describe, expect, test } from "bun:test";
import {
  matchesFilter,
  type FilterableFlat,
  type FlatFilter,
} from "./flat-filters";

const NOW = new Date("2026-07-15T12:00:00Z");

const base: FilterableFlat = {
  id: "flat-1",
  title: "Schöne 2-Zimmer-Wohnung",
  propertyManagementId: "gewobag",
  coldRentPrice: 800,
  warmRentPrice: 1000,
  roomCount: 2,
  usableArea: 60,
  firstSeen: new Date("2026-07-15T06:00:00Z"), // 6h ago → "new"
  postalCode: "10557", // Moabit / Mitte
};

const cases: {
  name: string;
  flat?: Partial<FilterableFlat>;
  filter: FlatFilter;
  want: boolean;
}[] = [
  { name: "empty filter matches all", filter: {}, want: true },

  // ids
  { name: "ids includes", filter: { ids: ["flat-1"] }, want: true },
  { name: "ids excludes", filter: { ids: ["other"] }, want: false },
  { name: "empty ids matches nothing", filter: { ids: [] }, want: false },

  // property managements
  {
    name: "propertyManagements match",
    filter: { propertyManagements: ["gewobag"] },
    want: true,
  },
  {
    name: "propertyManagements no match",
    filter: { propertyManagements: ["vonovia"] },
    want: false,
  },
  {
    name: "null propertyManagementId never matches a pm filter",
    flat: { propertyManagementId: null },
    filter: { propertyManagements: ["gewobag"] },
    want: false,
  },

  // price: OR over warm/cold, null-safe
  {
    name: "priceMin met by warm",
    filter: { priceMin: 900 },
    want: true,
  },
  {
    name: "priceMin met by cold when warm null",
    flat: { warmRentPrice: null, coldRentPrice: 850 },
    filter: { priceMin: 820 },
    want: true,
  },
  {
    name: "priceMin unmet by both",
    flat: { warmRentPrice: 500, coldRentPrice: 400 },
    filter: { priceMin: 900 },
    want: false,
  },
  {
    name: "both prices null fails priceMin",
    flat: { warmRentPrice: null, coldRentPrice: null },
    filter: { priceMin: 1 },
    want: false,
  },
  {
    name: "priceMax met by cold (OR keeps it even though warm exceeds)",
    flat: { warmRentPrice: 2000, coldRentPrice: 800 },
    filter: { priceMax: 900 },
    want: true,
  },

  // rooms / area: null-guarded
  { name: "roomsMin met", filter: { roomsMin: 2 }, want: true },
  { name: "roomsMin unmet", filter: { roomsMin: 3 }, want: false },
  {
    name: "null roomCount fails roomsMin",
    flat: { roomCount: null },
    filter: { roomsMin: 1 },
    want: false,
  },
  { name: "areaMax met", filter: { areaMax: 60 }, want: true },
  { name: "areaMax unmet", filter: { areaMax: 50 }, want: false },
  {
    name: "null usableArea fails areaMax",
    flat: { usableArea: null },
    filter: { areaMax: 100 },
    want: false,
  },

  // districts → zipCodes
  {
    name: "district matches by zip",
    filter: { districts: ["moabit"] },
    want: true,
  },
  {
    name: "district no match",
    flat: { postalCode: "99999" },
    filter: { districts: ["moabit"] },
    want: false,
  },

  // "new" pseudo-tag
  { name: "new tag matches recent", filter: { tags: ["new"] }, want: true },
  {
    name: "new tag rejects old",
    flat: { firstSeen: new Date("2026-07-10T00:00:00Z") },
    filter: { tags: ["new"] },
    want: false,
  },

  // title-derived tags
  {
    name: "altbau tag matches title",
    flat: { title: "Charmante Altbauwohnung" },
    filter: { tags: ["altbau"] },
    want: true,
  },
  {
    name: "altbau tag rejects non-matching title",
    filter: { tags: ["altbau"] },
    want: false,
  },
  {
    name: "new + altbau: recent but wrong title fails",
    filter: { tags: ["new", "altbau"] },
    want: false,
  },

  // combined
  {
    name: "combined all satisfied",
    filter: {
      propertyManagements: ["gewobag"],
      priceMin: 900,
      roomsMin: 2,
      areaMax: 70,
      districts: ["moabit"],
    },
    want: true,
  },
  {
    name: "combined one unsatisfied",
    filter: {
      propertyManagements: ["gewobag"],
      priceMin: 900,
      roomsMin: 5,
    },
    want: false,
  },
];

describe("matchesFilter", () => {
  for (const { name, flat, filter, want } of cases) {
    test(name, () => {
      expect(matchesFilter({ ...base, ...flat }, filter, NOW)).toBe(want);
    });
  }
});
