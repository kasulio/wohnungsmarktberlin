import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { type PropertyManagement, type ScrapedFlat } from "~/data/schemas";
import { FetchError, Http } from "~/lib/http";
import { flat, flatUrlJob, scraperRun } from "~/server/db/schema";
import { type DbClient } from "~/server/db/service";
import { makeTestDb, testDbLayer } from "~/server/db/testing";
import { type AdminScrapeOptions, adminScrape } from "./admin-scrape";
import { AddressImprovement, Scrapers } from "./services";

let db: DbClient;
let listings: Partial<Record<PropertyManagementId, string[] | Error>>;
let pages: Map<string, string>;
let requested: string[];

beforeEach(() => {
  db = makeTestDb();
  listings = {};
  pages = new Map();
  requested = [];
});

const scraper = (slug: PropertyManagementId): PropertyManagement => ({
  slug,
  name: slug,
  extractUrls: async () => {
    const urls = listings[slug] ?? [];
    if (urls instanceof Error) throw urls;
    return urls;
  },
  extractDataFromHtml: (html) => JSON.parse(html) as ScrapedFlat,
});

const page = (url: string) =>
  JSON.stringify({
    url,
    title: "Wohnung",
    addressText: "Musterstraße 1, 10115 Berlin",
    imageUrl: null,
  } satisfies ScrapedFlat);

const run = (options: AdminScrapeOptions) =>
  Effect.runPromise(
    adminScrape(options).pipe(
      Effect.provide(
        Layer.mergeAll(
          testDbLayer(db),
          Layer.succeed(Http, {
            text: (req) =>
              Effect.suspend(() => {
                requested.push(req.url);
                const body = pages.get(req.url);
                return body === undefined
                  ? Effect.fail(
                      FetchError.of(req.url, { reason: "status", status: 404 }),
                    )
                  : Effect.succeed(body);
              }),
            json: () => Effect.die("unused"),
            bytes: () => Effect.die("unused"),
          }),
          Layer.succeed(Scrapers, {
            degewo: scraper("degewo"),
            gewobag: scraper("gewobag"),
          }),
          Layer.succeed(AddressImprovement, { run: async () => undefined }),
        ),
      ),
    ),
  );

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const loggedRuns = () => db.select().from(scraperRun).all();

test("a full run prunes, syncs each company, extracts their new jobs and logs the run", async () => {
  const stale = "https://gewobag.example/flat/stale";
  db.insert(flat)
    .values({
      url: stale,
      propertyManagementId: "gewobag",
      title: "t",
      addressText: "a",
      firstSeen: daysAgo(30),
      lastSeen: daysAgo(8),
    })
    .run();
  const url = "https://degewo.example/flat/1";
  listings.degewo = [url];
  pages.set(url, page(url));

  const report = await run({
    mode: "full",
    targets: ["degewo"],
    scoped: true,
    extractBatch: 5,
  });

  expect(report).toEqual({
    mode: "full",
    syncResults: [
      {
        slug: "degewo",
        success: true,
        stats: expect.objectContaining({ extractedUrls: 1, newJobsCreated: 1 }),
      },
    ],
    extractionStats: { flatsExtracted: 1, flatsFailed: 0, flatsPending: 0 },
    pendingRemaining: 0,
  });
  expect(
    db.select().from(flat).where(eq(flat.url, stale)).get()!.deleted,
  ).not.toBeNull();
  expect(loggedRuns()).toEqual([
    expect.objectContaining({
      kind: "admin-scrape",
      trigger: "admin",
      success: true,
      errorMessage: null,
      propertyManagementId: null,
    }),
  ]);
  expect(JSON.parse(loggedRuns()[0]!.statsJson)).toEqual(
    JSON.parse(JSON.stringify(report)),
  );
});

const queueJob = (url: string, propertyManagementId: PropertyManagementId) =>
  db
    .insert(flatUrlJob)
    .values({
      url,
      propertyManagementId,
      createdAt: new Date(),
      status: "pending",
    })
    .run();

test("sync only queues jobs but extracts nothing, reporting what is pending", async () => {
  listings.degewo = [
    "https://degewo.example/flat/1",
    "https://degewo.example/flat/2",
  ];
  queueJob("https://gewobag.example/flat/1", "gewobag");

  const report = await run({
    mode: "sync_only",
    targets: ["degewo"],
    scoped: true,
    extractBatch: 5,
  });

  expect(requested).toEqual([]);
  expect(report.extractionStats).toEqual({
    flatsExtracted: 0,
    flatsFailed: 0,
    flatsPending: 2,
  });
  expect(report.pendingRemaining).toBe(2);
});

test("logs a failed run naming each failed sync and the failed extractions", async () => {
  listings.degewo = new Error("HTTP 503 for https://degewo.example/");
  listings.gewobag = ["https://gewobag.example/flat/gone"];

  const report = await run({
    mode: "full",
    targets: ["degewo", "gewobag"],
    scoped: true,
    extractBatch: 5,
  });

  expect(report.syncResults.map((s) => [s.slug, s.success])).toEqual([
    ["degewo", false],
    ["gewobag", true],
  ]);
  expect(loggedRuns()).toEqual([
    expect.objectContaining({
      success: false,
      errorMessage:
        "degewo: Could not list degewo: HTTP 503 for https://degewo.example/; extract: 1 fehlgeschlagen",
    }),
  ]);
});

test("an unscoped extract takes pending jobs of any company", async () => {
  for (const pm of ["degewo", "gewobag"] as const) {
    const url = `https://${pm}.example/flat/1`;
    queueJob(url, pm);
    pages.set(url, page(url));
  }

  const report = await run({
    mode: "extract_only",
    targets: ["degewo"],
    scoped: false,
    extractBatch: 5,
  });

  expect(report.syncResults).toEqual([]);
  expect(report.extractionStats.flatsExtracted).toBe(2);
});
