import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { MAX_BUCKETS, resetRateLimitBuckets, takeToken } from "./rate-limit";

afterEach(() => {
  resetRateLimitBuckets();
  setSystemTime(); // real clock again
});

describe("takeToken", () => {
  test("allows up to limit, then blocks", () => {
    expect(takeToken("a", 3, 60_000)).toBe(true);
    expect(takeToken("a", 3, 60_000)).toBe(true);
    expect(takeToken("a", 3, 60_000)).toBe(true);
    expect(takeToken("a", 3, 60_000)).toBe(false);
  });

  test("isolates keys", () => {
    expect(takeToken("a", 1, 60_000)).toBe(true);
    expect(takeToken("a", 1, 60_000)).toBe(false);
    expect(takeToken("b", 1, 60_000)).toBe(true);
  });

  test("resets after window elapses", () => {
    setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(takeToken("a", 1, 60_000)).toBe(true);
    expect(takeToken("a", 1, 60_000)).toBe(false);

    setSystemTime(new Date("2026-07-15T12:01:00Z"));
    expect(takeToken("a", 1, 60_000)).toBe(true);
  });

  test("sweep frees room when map is full", () => {
    setSystemTime(new Date("2026-07-15T12:00:00Z"));
    for (let i = 0; i < MAX_BUCKETS; i++) {
      takeToken(`k-${i}`, 1, 60_000);
    }
    // No expired entries — still accepts by dropping earliest-reset half.
    expect(takeToken("overflow", 1, 60_000)).toBe(true);
  });

  test("sweep prefers deleting expired over live buckets", () => {
    setSystemTime(new Date("2026-07-15T12:00:00Z"));
    for (let i = 0; i < MAX_BUCKETS - 1; i++) {
      takeToken(`exp-${i}`, 1, 10_000);
    }
    expect(takeToken("keeper", 1, 60_000)).toBe(true);

    setSystemTime(new Date("2026-07-15T12:00:11Z"));
    expect(takeToken("after", 1, 60_000)).toBe(true);
    expect(takeToken("keeper", 1, 60_000)).toBe(false);
  });
});
