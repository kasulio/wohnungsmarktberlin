import { describe, expect, test } from "bun:test";
import { shouldIgnoreDeuvonoListing } from "./deuvono";

describe("shouldIgnoreDeuvonoListing", () => {
  test("zero rooms", () => {
    expect(shouldIgnoreDeuvonoListing({ roomCount: 0 })).toBe(true);
  });

  test("null rooms", () => {
    expect(shouldIgnoreDeuvonoListing({ roomCount: null })).toBe(true);
  });

  test("undefined rooms", () => {
    expect(shouldIgnoreDeuvonoListing({})).toBe(true);
  });

  test("cheap listing with rooms", () => {
    expect(
      shouldIgnoreDeuvonoListing({
        roomCount: 1,
        coldRentPrice: 80,
      }),
    ).toBe(true);
  });

  test("cheap listing via warm rent only", () => {
    expect(
      shouldIgnoreDeuvonoListing({
        roomCount: 1,
        warmRentPrice: 80,
      }),
    ).toBe(true);
  });

  test("rent exactly 100 is ignored", () => {
    expect(
      shouldIgnoreDeuvonoListing({
        roomCount: 2,
        coldRentPrice: 100,
      }),
    ).toBe(true);
  });

  test("rent 101 with rooms passes", () => {
    expect(
      shouldIgnoreDeuvonoListing({
        roomCount: 2,
        coldRentPrice: 101,
      }),
    ).toBe(false);
  });

  test("residential listing passes", () => {
    expect(
      shouldIgnoreDeuvonoListing({
        roomCount: 3,
        coldRentPrice: 800,
      }),
    ).toBe(false);
  });
});
