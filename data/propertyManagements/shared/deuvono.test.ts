import { expect, test } from "bun:test";
import {
  type DeuvonoFetchJson,
  extractDeuvonoDataFromHtml,
  extractDeuvonoUrls,
} from "./deuvono";

/** Mimics the list API: at most 50 per request, a search token in a header. */
const fakeApi = (total: number) => {
  const calls: { url: URL; token?: string }[] = [];
  const fetchJson: DeuvonoFetchJson = async (url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/search-token")) {
      return { token: "tok-1", ttl: 3600 };
    }
    calls.push({
      url: parsed,
      token: options?.headers?.["X-VON-Search-Token"],
    });
    const limit = Number(parsed.searchParams.get("limit"));
    const offset = Number(parsed.searchParams.get("offset") ?? 0);
    if (limit > 50) throw new Error("HTTP 406");
    const slugs = Array.from({ length: total }, (_, i) => `flat-${i}`);
    return {
      paging: { info: { count: total, limit } },
      results: slugs.slice(offset, offset + limit).map((slug) => ({ slug })),
    };
  };
  return { calls, fetchJson };
};

test("pages through all Berlin listings, 50 at a time, with the search token", async () => {
  const api = fakeApi(120);

  const urls = await extractDeuvonoUrls("vonovia", api.fetchJson);

  expect(urls).toHaveLength(120);
  expect(urls[0]).toBe(
    "https://www.vonovia.de/zuhause-finden/immobilien/flat-0",
  );
  expect(urls[119]).toBe(
    "https://www.vonovia.de/zuhause-finden/immobilien/flat-119",
  );
  expect(api.calls.map((c) => c.url.searchParams.get("offset"))).toEqual([
    "0",
    "50",
    "100",
  ]);
  expect(api.calls.every((c) => c.token === "tok-1")).toBe(true);
  expect(api.calls[0]!.url.searchParams.get("city")).toBe("Berlin");
});

test("uses the Deutsche Wohnen endpoints for deuwo", async () => {
  const api = fakeApi(3);

  const urls = await extractDeuvonoUrls("deuwo", api.fetchJson);

  expect(api.calls[0]!.url.origin + api.calls[0]!.url.pathname).toBe(
    "https://www.deutsche-wohnen.com/api/deuwo-real-estate/list",
  );
  expect(urls).toEqual([
    "https://www.deutsche-wohnen.com/mieten/mietangebote/flat-0",
    "https://www.deutsche-wohnen.com/mieten/mietangebote/flat-1",
    "https://www.deutsche-wohnen.com/mieten/mietangebote/flat-2",
  ]);
});

test("finds nothing when there are no listings", async () => {
  const api = fakeApi(0);
  expect(await extractDeuvonoUrls("vonovia", api.fetchJson)).toEqual([]);
  expect(api.calls).toHaveLength(1);
});

const detailPage = (data: object) =>
  `<html><body><div data-vonovia-data="${JSON.stringify(data).replace(/"/g, "&quot;")}"></div></body></html>`;

test("reads a German decimal room count like 2,5", () => {
  const flat = extractDeuvonoDataFromHtml(
    detailPage({
      heading: "2,5-Zimmer-Wohnung",
      numberOfRooms: "2,5",
      rent: 757.37,
    }),
    "https://www.vonovia.de/zuhause-finden/immobilien/x",
  );
  expect(flat.roomCount).toBe(2.5);
});
