import { describe, expect, test } from "bun:test";
import {
  getApartmentTags,
  getDisplayTags,
  tagTitleKeywords,
  titleToTagsMap,
  tags,
} from "./tags";

describe("getApartmentTags", () => {
  test("matches keyword in title", () => {
    expect(getApartmentTags("Schöne Altbauwohnung")).toEqual(["altbau"]);
  });

  test("dedupes when multiple keywords map to same tag", () => {
    expect(
      getApartmentTags("WBS Wohnberechtigungsschein erforderlich"),
    ).toEqual(["wbs"]);
  });

  test("matches multiple tags", () => {
    expect(getApartmentTags("Neubau Erstbezug")).toEqual(
      expect.arrayContaining(["neubau", "erstbezug"]),
    );
  });
});

describe("getDisplayTags", () => {
  test("appends new without mutating derived tags", () => {
    const derived = getApartmentTags("Altbau");
    const display = getDisplayTags("Altbau", true);
    expect(display).toEqual(["altbau", "new"]);
    expect(derived).toEqual(["altbau"]);
  });
});

describe("tagTitleKeywords", () => {
  test("every title-derived tag has keywords for SQL filter", () => {
    const titleDerivedTags = Object.values(titleToTagsMap).flat();
    const uniqueTags = [...new Set(titleDerivedTags)];

    for (const tag of uniqueTags) {
      expect(tagTitleKeywords[tag]?.length).toBeGreaterThan(0);
    }
  });

  test("keyword in title implies tag from getApartmentTags", () => {
    for (const [keyword, tagList] of Object.entries(titleToTagsMap)) {
      const derived = getApartmentTags(`Angebot mit ${keyword}`);
      for (const tag of tagList) {
        expect(derived).toContain(tag);
      }
    }
  });
});

describe("tags catalog", () => {
  test("no display-only tags without title keywords", () => {
    const tagsWithKeywords = new Set(Object.keys(tagTitleKeywords));
    const titleDerivedInCatalog = Object.keys(tags).filter((t) => t !== "new");

    for (const tag of titleDerivedInCatalog) {
      expect(tagsWithKeywords.has(tag)).toBe(true);
    }
  });
});
