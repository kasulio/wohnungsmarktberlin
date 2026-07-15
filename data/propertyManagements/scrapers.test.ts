import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { expectedValues } from "~/data/fixtures/expected";
import { propertyManagements } from "~/data/propertyManagements";
import { assertFlatShape } from "./shape-contract";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

const scrapersBySlug = Object.fromEntries(
  Object.values(propertyManagements).map((s) => [s.slug, s]),
);

describe("scraper fixtures", () => {
  for (const [filename, expected] of Object.entries(expectedValues)) {
    test(filename, () => {
      const scraper = scrapersBySlug[expected.slug];
      if (!scraper) {
        throw new Error(`No scraper found for slug "${expected.slug}"`);
      }

      const html = readFileSync(join(FIXTURES_DIR, filename), "utf-8");
      const flat = scraper.extractDataFromHtml(
        html,
        `https://fixture.test/${filename}`,
      );

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
