import { expect, test } from "bun:test";
import { cleanHowogeAddress } from "./howoge";

test.each([
  [
    "Adresse:\n\n   Treskowstraße 12,\n\n   13089 Berlin, Niederschönhausen",
    "Treskowstraße 12, 13089 Berlin",
  ],
  [
    "Adresse:\n  Streitstraße 5,\n  13587 Berlin",
    "Streitstraße 5, 13587 Berlin",
  ],
  [
    "Adresse:\n  Schönerlinder Str. 2,\n  16341 Panketal, Zepernick",
    "Schönerlinder Str. 2, 16341 Panketal",
  ],
  ["  Irgendwo   1  ", "Irgendwo 1"],
])("cleans %p", (raw, expected) => {
  expect(cleanHowogeAddress(raw)).toBe(expected);
});
