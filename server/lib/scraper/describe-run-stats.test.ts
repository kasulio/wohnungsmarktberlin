import { describe, expect, test } from "bun:test";
import { describeRunStats } from "./describe-run-stats";

describe("describeRunStats", () => {
  test("a sync run", () => {
    expect(
      describeRunStats(
        JSON.stringify({
          existingActiveFlats: 40,
          extractedUrls: 67,
          flatsDeleted: 3,
          newJobsCreated: 2,
          flatsUpdated: 0,
          duplicateJobsFiltered: 0,
          jobsReset: 0,
        }),
      ),
    ).toBe("67 Inserate gefunden · 2 neu · 3 entfernt");
  });

  test("an extract run", () => {
    expect(
      describeRunStats(
        JSON.stringify({ flatsExtracted: 5, flatsFailed: 2, flatsPending: 9 }),
      ),
    ).toBe("5 extrahiert · 2 Fehler · 9 offen");
  });

  test("an admin run that synced and extracted", () => {
    expect(
      describeRunStats(
        JSON.stringify({
          mode: "full",
          syncResults: [
            {
              slug: "degewo",
              success: true,
              stats: { extractedUrls: 67, newJobsCreated: 2 },
            },
            { slug: "wbm", success: false, error: "HTTP 503" },
          ],
          extractionStats: {
            flatsExtracted: 5,
            flatsFailed: 0,
            flatsPending: 9,
          },
          pendingRemaining: 9,
        }),
      ),
    ).toBe("1/2 synchronisiert · 2 neu · 5 extrahiert · 9 offen");
  });

  test("an admin extract-only run", () => {
    expect(
      describeRunStats(
        JSON.stringify({
          mode: "extract_only",
          syncResults: [],
          extractionStats: {
            flatsExtracted: 5,
            flatsFailed: 0,
            flatsPending: 33,
          },
          pendingRemaining: 33,
        }),
      ),
    ).toBe("5 extrahiert · 33 offen");
  });

  test("anything else is shown as it is, shortened", () => {
    expect(describeRunStats("not json")).toBe("not json");
    expect(describeRunStats(JSON.stringify({ foo: 1 }))).toBe('{"foo":1}');
  });
});
