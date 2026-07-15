import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import {
  expectedValues,
  expectedMissingRoomsArea,
} from "~/data/fixtures/expected";
import { propertyManagements } from "~/data/propertyManagements";
import { assertFlatShape, assertScrapedFlatSchema } from "./shape-contract";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

const scrapersBySlug = Object.fromEntries(
  Object.values(propertyManagements).map((s) => [s.slug, s]),
);

function runScraper(filename: string, slug: string) {
  const scraper = scrapersBySlug[slug];
  if (!scraper) {
    throw new Error(`No scraper found for slug "${slug}"`);
  }
  const html = readFileSync(join(FIXTURES_DIR, filename), "utf-8");
  return scraper.extractDataFromHtml(html, `https://fixture.test/${filename}`);
}

describe("scraper fixtures", () => {
  for (const [filename, expected] of Object.entries(expectedValues)) {
    test(filename, () => {
      const flat = runScraper(filename, expected.slug);

      assertFlatShape(flat, filename);

      expect(flat.title).toBe(expected.title);
      expect(flat.coldRentPrice).toBe(expected.coldRentPrice);
      expect(flat.warmRentPrice).toBe(expected.warmRentPrice);
      expect(flat.roomCount).toBe(expected.roomCount);
      expect(flat.usableArea).toBe(expected.usableArea);
      expect(flat.addressText).toBe(expected.addressText);

      if (expected.floor !== undefined) {
        expect(flat.floor).toBe(expected.floor);
      }
      if (expected.imageUrl !== undefined) {
        expect(flat.imageUrl).toBe(expected.imageUrl);
      }
    });
  }
});

describe("scraper fixtures – missing rooms/area", () => {
  for (const [filename, expected] of Object.entries(expectedMissingRoomsArea)) {
    test(filename, () => {
      const flat = runScraper(filename, expected.slug);

      assertScrapedFlatSchema(flat, filename);

      expect(flat.title).toBe(expected.title);
      expect(flat.coldRentPrice).toBe(expected.coldRentPrice);
      expect(flat.warmRentPrice).toBe(expected.warmRentPrice);
      expect(flat.roomCount ?? null).toBeNull();
      expect(flat.usableArea ?? null).toBeNull();
      expect(flat.addressText).toBe(expected.addressText);

      if (expected.floor !== undefined) {
        expect(flat.floor).toBe(expected.floor);
      }
      if (expected.imageUrl !== undefined) {
        expect(flat.imageUrl).toBe(expected.imageUrl);
      }
    });
  }
});
