import { describe, expect, test } from "bun:test";
import { parseNumberString } from "./parser";

describe("parseNumberString", () => {
  test.each([
    ["1.250,00", 1250],
    ["1.250", 1250],
    ["1.250.000", 1250000],
    ["1 250,00", 1250],
    ["1 250,00", 1250],
    ["1 250,00", 1250],
    ["629,87", 629.87],
    ["2,5", 2.5],
    ["55.5", 55.5],
    ["64.25", 64.25],
    ["1,250.50", 1250.5],
    ["800", 800],
    ["  42,1 ", 42.1],
    ["55,0 55,0 Quadratmeter", 55],
    ["48,0 48,0", 48],
  ])("reads %p as %p", (input, expected) => {
    expect(parseNumberString(input)).toBe(expected);
  });

  test.each([undefined, "", "abc"])("gives undefined for %p", (input) => {
    expect(parseNumberString(input)).toBeUndefined();
  });
});
