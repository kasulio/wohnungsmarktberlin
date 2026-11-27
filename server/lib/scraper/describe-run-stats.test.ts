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

  test("an address-improvement run", () => {
    expect(
      describeRunStats(
        JSON.stringify({
          addressesImproved: 4,
          addressesFailed: 1,
          addressesTransientFailed: 2,
          addressesPending: 3,
        }),
      ),
    ).toBe(
      "4 geocodiert · 1 nicht gefunden · 2 vorübergehend fehlgeschlagen · 3 offen",
    );
  });

  test("a notify run", () => {
    expect(
      describeRunStats(
        JSON.stringify({
          stamped: 2,
          subscribers: 5,
          candidates: 3,
          sent: 4,
          failed: 1,
          deactivated: 1,
        }),
      ),
    ).toBe("4 gesendet · 2 neu sichtbar · 1 Fehler · 1 deaktiviert");
  });

  test("a map-preview run", () => {
    expect(describeRunStats(JSON.stringify({ regenerated: true }))).toBe(
      "Kartenbild aktualisiert",
    );
  });

  test("anything else is shown as it is, shortened", () => {
    expect(describeRunStats("not json")).toBe("not json");
    expect(describeRunStats(JSON.stringify({ foo: 1 }))).toBe('{"foo":1}');
  });
});
