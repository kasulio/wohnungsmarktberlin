import { beforeEach, describe, expect, test } from "bun:test";
import { resetOpsAlertCooldownsForTests, sendOpsAlert } from "./ops-alerts";

beforeEach(() => {
  resetOpsAlertCooldownsForTests();
});

describe("sendOpsAlert", () => {
  test("deduplicates alerts per key within the cooldown window and escapes HTML", async () => {
    const sent: Array<{ chatId: string; html: string }> = [];
    const send = async (chatId: string, html: string) => {
      sent.push({ chatId, html });
    };

    const first = await sendOpsAlert({
      key: "sync-fail:degewo",
      title: "Scraper <degewo> failed",
      details: "HTTP 503 & timeout",
      chatId: "12345",
      cooldownMs: 60_000,
      now: 1000,
      send,
    });
    expect(first).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.html).toContain("&lt;degewo&gt;");
    expect(sent[0]!.html).toContain("HTTP 503 &amp; timeout");

    // Within cooldown: suppressed
    const second = await sendOpsAlert({
      key: "sync-fail:degewo",
      title: "Scraper <degewo> failed again",
      chatId: "12345",
      cooldownMs: 60_000,
      now: 30_000,
      send,
    });
    expect(second).toBe(false);
    expect(sent).toHaveLength(1);

    // After cooldown: delivered again
    const third = await sendOpsAlert({
      key: "sync-fail:degewo",
      title: "Scraper <degewo> still failing",
      chatId: "12345",
      cooldownMs: 60_000,
      now: 70_000,
      send,
    });
    expect(third).toBe(true);
    expect(sent).toHaveLength(2);
  });

  test("never throws when telegram delivery fails", async () => {
    const ok = await sendOpsAlert({
      key: "test-fail",
      title: "boom",
      chatId: "12345",
      send: async () => {
        throw new Error("telegram unreachable");
      },
    });
    expect(ok).toBe(false);
  });
});
