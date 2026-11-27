import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { type PropertyManagement, type ScrapedFlat } from "~/data/schemas";
import { FetchError, Http, type HttpRequest } from "~/lib/http";
import { flat, flatUrlJob } from "~/server/db/schema";
import { type DbClient } from "~/server/db/service";
import { makeTestDb, testDbLayer } from "~/server/db/testing";
import { extractFlats } from "./extract-flats";
import { AddressImprovement, ExtractPacing, Scrapers } from "./services";

let db: DbClient;
let pages: Map<string, string | FetchError>;
let images: Map<string, Uint8Array>;
let requests: (HttpRequest & { at: number })[];
let addressImprovementRuns: number;
let addressImprovementFails: boolean;
let pageDelayMs: number;
let inFlight: Map<string, number>;
let peakInFlight: { perHost: number; total: number };

beforeEach(() => {
  db = makeTestDb();
  pages = new Map();
  images = new Map();
  requests = [];
  addressImprovementRuns = 0;
  addressImprovementFails = false;
  pageDelayMs = 0;
  inFlight = new Map();
  peakInFlight = { perHost: 0, total: 0 };
});

const track = (url: string, delta: number) => {
  const host = new URL(url).host;
  inFlight.set(host, (inFlight.get(host) ?? 0) + delta);
  const total = [...inFlight.values()].reduce((a, b) => a + b, 0);
  peakInFlight.perHost = Math.max(peakInFlight.perHost, inFlight.get(host)!);
  peakInFlight.total = Math.max(peakInFlight.total, total);
};

const listing = (url: string, overrides: Partial<ScrapedFlat> = {}) =>
  ({
    url,
    title: "2-Zimmer-Wohnung mit Balkon",
    addressText: "Musterstraße 1, 10115 Berlin",
    coldRentPrice: 600,
    warmRentPrice: 800,
    roomCount: 2,
    usableArea: 55.5,
    floor: 3,
    imageUrl: null,
    ...overrides,
  }) satisfies ScrapedFlat;

/** Listing pages carry their ScrapedFlat as JSON, so the fake scraper just parses them. */
const fakeScraper = (slug: string): PropertyManagement => ({
  slug,
  name: slug,
  extractUrls: async () => [],
  extractDataFromHtml: (html) => JSON.parse(html) as ScrapedFlat,
});

const fakeHttp = Layer.succeed(Http, {
  text: (req) =>
    Effect.gen(function* () {
      requests.push({ ...req, at: performance.now() });
      track(req.url, 1);
      yield* Effect.sleep(`${pageDelayMs} millis`);
      const page = pages.get(req.url);
      if (page === undefined)
        return yield* FetchError.of(req.url, { reason: "status", status: 404 });
      if (typeof page !== "string") return yield* page;
      return page;
    }).pipe(Effect.ensuring(Effect.sync(() => track(req.url, -1)))),
  json: () => Effect.die("unused"),
  bytes: (req) =>
    Effect.suspend(() => {
      requests.push({ ...req, at: performance.now() });
      const image = images.get(req.url);
      return image
        ? Effect.succeed(image)
        : Effect.fail(
            FetchError.of(req.url, { reason: "status", status: 404 }),
          );
    }),
});

const run = (options: Parameters<typeof extractFlats>[0]) =>
  Effect.runPromise(
    extractFlats(options).pipe(
      Effect.provideService(ExtractPacing, {
        background: { minMillis: 60, maxMillis: 80 },
      }),
      Effect.provide(
        Layer.mergeAll(
          testDbLayer(db),
          fakeHttp,
          Layer.succeed(Scrapers, {
            degewo: fakeScraper("degewo"),
            gewobag: fakeScraper("gewobag"),
          }),
          Layer.succeed(AddressImprovement, {
            run: async () => {
              addressImprovementRuns++;
              if (addressImprovementFails) throw new Error("photon down");
            },
          }),
        ),
      ),
    ),
  );

const queueJob = (
  url: string,
  propertyManagementId: PropertyManagementId = "degewo",
  createdAt = new Date(),
) =>
  db
    .insert(flatUrlJob)
    .values({ url, propertyManagementId, createdAt, status: "pending" })
    .run();

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwmTkTAAKgAaDhP4jzAAAAAElFTkSuQmCC";

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

const jobFor = (url: string) =>
  db.select().from(flatUrlJob).where(eq(flatUrlJob.url, url)).get();

test("extracts a pending job into a new flat and completes the job", async () => {
  const url = "https://degewo.example/flat/1";
  queueJob(url);
  pages.set(url, JSON.stringify(listing(url)));

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats).toEqual({ flatsExtracted: 1, flatsFailed: 0, flatsPending: 0 });
  expect(db.select().from(flat).all()).toEqual([
    expect.objectContaining({
      url,
      propertyManagementId: "degewo",
      title: "2-Zimmer-Wohnung mit Balkon",
      coldRentPrice: 600,
      roomCount: 2,
      usableArea: 55.5,
      deleted: null,
      ignored: false,
      image: null,
    }),
  ]);
  expect(jobFor(url)).toMatchObject({ status: "completed", lastError: null });
  expect(addressImprovementRuns).toBe(1);
});

test("records a failed fetch on its job in readable form and carries on", async () => {
  const gone = "https://degewo.example/flat/gone";
  const ok = "https://degewo.example/flat/ok";
  queueJob(gone, "degewo", minutesAgo(2));
  queueJob(ok, "degewo", minutesAgo(1));
  pages.set(ok, JSON.stringify(listing(ok)));

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats).toEqual({ flatsExtracted: 1, flatsFailed: 1, flatsPending: 0 });
  expect(jobFor(gone)).toMatchObject({
    status: "failed",
    lastError: `HTTP 404 for ${gone}`,
    attempts: 1,
  });
});

test("names the offending fields when a listing does not parse", async () => {
  const url = "https://degewo.example/flat/broken";
  queueJob(url);
  pages.set(url, JSON.stringify({ url, title: 42 }));

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats).toMatchObject({ flatsExtracted: 0, flatsFailed: 1 });
  const { lastError } = jobFor(url)!;
  expect(lastError).toStartWith("Listing did not parse: ");
  expect(lastError).toContain("title");
  expect(lastError).toContain("addressText");
  expect(addressImprovementRuns).toBe(0);
});

test("updates and revives an existing flat, keeping when it was first seen", async () => {
  const url = "https://degewo.example/flat/known";
  const firstSeen = new Date("2026-01-01T00:00:00Z");
  db.insert(flat)
    .values({
      url,
      propertyManagementId: "degewo",
      title: "old title",
      addressText: "old address",
      coldRentPrice: 1,
      firstSeen,
      lastSeen: firstSeen,
      deleted: firstSeen,
    })
    .run();
  queueJob(url);
  pages.set(url, JSON.stringify(listing(url, { coldRentPrice: 700 })));

  await run({ limit: 10, pace: "interactive" });

  const rows = db.select().from(flat).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    title: "2-Zimmer-Wohnung mit Balkon",
    coldRentPrice: 700,
    deleted: null,
    firstSeen,
  });
  expect(rows[0]!.lastSeen.getTime()).toBeGreaterThan(firstSeen.getTime());
});

test("takes the oldest pending jobs up to the limit, of the given companies only", async () => {
  for (const [i, pm] of (
    ["gewobag", "degewo", "degewo", "degewo"] as const
  ).entries()) {
    const url = `https://${pm}.example/flat/${i}`;
    queueJob(url, pm, minutesAgo(10 - i));
    pages.set(url, JSON.stringify(listing(url)));
  }

  const stats = await run({
    limit: 2,
    pace: "interactive",
    propertyManagementIds: ["degewo"],
  });

  expect(requests.map((r) => r.url)).toEqual([
    "https://degewo.example/flat/1",
    "https://degewo.example/flat/2",
  ]);
  expect(stats).toEqual({ flatsExtracted: 2, flatsFailed: 0, flatsPending: 1 });
});

test("drops jobs older than three days before picking work", async () => {
  const day = 24 * 60 * 60 * 1000;
  const stale = "https://degewo.example/flat/stale";
  const fresh = "https://degewo.example/flat/fresh";
  const failedRecent = "https://degewo.example/flat/failed-recent";
  queueJob(stale, "degewo", new Date(Date.now() - 4 * day));
  queueJob(fresh, "degewo", new Date(Date.now() - 2 * day));
  db.insert(flatUrlJob)
    .values({
      url: failedRecent,
      propertyManagementId: "degewo",
      createdAt: new Date(Date.now() - 5 * day),
      status: "failed",
      lastError: "HTTP 500",
    })
    .run();
  pages.set(stale, JSON.stringify(listing(stale)));
  pages.set(fresh, JSON.stringify(listing(fresh)));

  await run({ limit: 10, pace: "interactive" });

  expect(requests.map((r) => r.url)).toEqual([fresh]);
  expect(jobFor(stale)).toBeUndefined();
  expect(jobFor(failedRecent)).toMatchObject({ status: "failed" });
});

test("works on several companies at once, but one job at a time per company", async () => {
  pageDelayMs = 20;
  for (const pm of ["degewo", "gewobag"] as const) {
    for (let i = 0; i < 3; i++) {
      const url = `https://${pm}.example/flat/${i}`;
      queueJob(url, pm, minutesAgo(10 - i));
      pages.set(url, JSON.stringify(listing(url)));
    }
  }

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats.flatsExtracted).toBe(6);
  expect(peakInFlight).toEqual({ perHost: 1, total: 2 });
});

test("in the background, pauses between the jobs of one company", async () => {
  for (let i = 0; i < 2; i++) {
    const url = `https://degewo.example/flat/${i}`;
    queueJob(url, "degewo", minutesAgo(10 - i));
    pages.set(url, JSON.stringify(listing(url)));
  }

  await run({ limit: 10, pace: "background" });

  expect(requests).toHaveLength(2);
  expect(requests[1]!.at - requests[0]!.at).toBeGreaterThanOrEqual(55);
});

test("still reports the run when the follow-up address improvement fails", async () => {
  addressImprovementFails = true;
  const url = "https://degewo.example/flat/1";
  queueJob(url);
  pages.set(url, JSON.stringify(listing(url)));

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats).toEqual({ flatsExtracted: 1, flatsFailed: 0, flatsPending: 0 });
  expect(addressImprovementRuns).toBe(1);
});

test("stores a thumbnail of the listing image, fetched like any other request", async () => {
  const url = "https://degewo.example/flat/1";
  const imageUrl = "https://degewo.example/img/1.png";
  const png = await new Bun.Image(Buffer.from(ONE_PIXEL_PNG, "base64"))
    .resize(400, 300)
    .bytes();
  images.set(imageUrl, png);
  queueJob(url);
  pages.set(url, JSON.stringify(listing(url, { imageUrl })));

  await run({ limit: 10, pace: "interactive" });

  expect(requests.map((r) => r.url)).toEqual([url, imageUrl]);
  const stored = db.select().from(flat).get()!.image!;
  expect(await new Bun.Image(stored).metadata()).toMatchObject({
    width: 200,
    height: 150,
  });
});

test("keeps the flat without an image when the image cannot be loaded", async () => {
  const url = "https://degewo.example/flat/1";
  queueJob(url);
  pages.set(
    url,
    JSON.stringify(
      listing(url, { imageUrl: "https://degewo.example/img/missing.png" }),
    ),
  );

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats.flatsExtracted).toBe(1);
  expect(db.select().from(flat).get()!.image).toBeNull();
});

test("fails a job whose company has no scraper", async () => {
  const url = "https://howoge.example/flat/1";
  queueJob(url, "howoge");

  const stats = await run({ limit: 10, pace: "interactive" });

  expect(stats).toMatchObject({ flatsExtracted: 0, flatsFailed: 1 });
  expect(jobFor(url)?.lastError).toBe("No scraper configured for howoge");
  expect(requests).toEqual([]);
});
