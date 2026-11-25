import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Effect, Layer, Result } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { type PropertyManagement } from "~/data/schemas";
import { flat, flatUrlJob } from "~/server/db/schema";
import { type Db, type DbClient } from "~/server/db/service";
import { makeTestDb, testDbLayer } from "~/server/db/testing";
import { Scrapers } from "./services";
import { syncListings } from "./sync-listings";

let db: DbClient;
let listed: string[] | Error;

beforeEach(() => {
  db = makeTestDb();
  listed = [];
});

const fakeScraper: PropertyManagement = {
  slug: "degewo",
  name: "degewo",
  extractUrls: async () => {
    if (listed instanceof Error) throw listed;
    return listed;
  },
  extractDataFromHtml: () => {
    throw new Error("unused");
  },
};

const provide = <A, E>(effect: Effect.Effect<A, E, Scrapers | Db>) =>
  effect.pipe(
    Effect.provide(
      Layer.mergeAll(
        testDbLayer(db),
        Layer.succeed(Scrapers, { degewo: fakeScraper }),
      ),
    ),
  );

const sync = (id: PropertyManagementId = "degewo") =>
  Effect.runPromise(provide(syncListings(id)));

const syncFailure = async (id: PropertyManagementId = "degewo") => {
  const result = await Effect.runPromise(
    Effect.result(provide(syncListings(id))),
  );
  if (Result.isSuccess(result)) throw new Error("expected a failure");
  return result.failure;
};

const url = (n: number) => `https://degewo.example/flat/${n}`;
const longAgo = new Date("2026-01-01T00:00:00Z");

const addFlat = (u: string, deleted: Date | null = null) =>
  db
    .insert(flat)
    .values({
      url: u,
      propertyManagementId: "degewo",
      title: "t",
      addressText: "a",
      firstSeen: longAgo,
      lastSeen: longAgo,
      deleted,
    })
    .run();

const addJob = (u: string, status: "pending" | "completed" | "failed") =>
  db
    .insert(flatUrlJob)
    .values({
      url: u,
      propertyManagementId: "degewo",
      createdAt: longAgo,
      status,
    })
    .run();

const flatFor = (u: string) =>
  db.select().from(flat).where(eq(flat.url, u)).get();
const jobFor = (u: string) =>
  db.select().from(flatUrlJob).where(eq(flatUrlJob.url, u)).get();

test("queues a pending job for each newly listed url, once", async () => {
  listed = [url(1), url(2), url(1)];

  const stats = await sync();

  expect(stats).toMatchObject({ extractedUrls: 2, newJobsCreated: 2 });
  expect(
    db
      .select()
      .from(flatUrlJob)
      .all()
      .map((j) => [j.url, j.status]),
  ).toEqual([
    [url(1), "pending"],
    [url(2), "pending"],
  ]);
});

test("soft-deletes flats no longer listed and marks the rest as seen", async () => {
  addFlat(url(1));
  addFlat(url(2));
  listed = [url(1)];

  const stats = await sync();

  expect(stats).toMatchObject({
    existingActiveFlats: 2,
    flatsDeleted: 1,
    flatsUpdated: 1,
  });
  expect(flatFor(url(2))!.deleted).not.toBeNull();
  expect(flatFor(url(1))).toMatchObject({ deleted: null });
  expect(flatFor(url(1))!.lastSeen.getTime()).toBeGreaterThan(
    longAgo.getTime(),
  );
});

test("requeues a finished job when its url is listed again without an active flat", async () => {
  addFlat(url(1), longAgo);
  addJob(url(1), "completed");
  addJob(url(2), "failed");
  addJob(url(3), "pending");
  listed = [url(1), url(2), url(3)];

  const stats = await sync();

  expect(stats).toMatchObject({
    jobsReset: 2,
    duplicateJobsFiltered: 3,
    newJobsCreated: 0,
  });
  expect(jobFor(url(1))).toMatchObject({ status: "pending" });
  expect(jobFor(url(1))!.createdAt.getTime()).toBeGreaterThan(
    longAgo.getTime(),
  );
  expect(jobFor(url(2))).toMatchObject({ status: "pending" });
  expect(jobFor(url(3))!.createdAt).toEqual(longAgo);
});

test("changes nothing when the listing page cannot be read", async () => {
  addFlat(url(1));
  listed = new Error("HTTP 503 for https://degewo.example/");

  const error = await syncFailure();

  expect(error).toMatchObject({
    _tag: "ListingsError",
    message: "Could not list degewo: HTTP 503 for https://degewo.example/",
  });
  expect(flatFor(url(1))).toMatchObject({ deleted: null, lastSeen: longAgo });
});

test("fails for a company without a scraper", async () => {
  const error = await syncFailure("howoge");
  expect(error).toMatchObject({ message: "No scraper configured for howoge" });
});

test("aborts without deleting when 0 urls are returned against 3+ active flats", async () => {
  addFlat(url(1));
  addFlat(url(2));
  addFlat(url(3));
  listed = [];

  const error = await syncFailure();

  expect(error).toMatchObject({
    _tag: "EmptyListingsAnomalyError",
    existingActiveFlats: 3,
  });
  expect(flatFor(url(1))!.deleted).toBeNull();
  expect(flatFor(url(2))!.deleted).toBeNull();
  expect(flatFor(url(3))!.deleted).toBeNull();
});

test("still allows legitimate delisting to 0 when fewer than 3 flats were active", async () => {
  addFlat(url(1));
  addFlat(url(2));
  listed = [];

  const stats = await sync();

  expect(stats).toMatchObject({ existingActiveFlats: 2, flatsDeleted: 2 });
  expect(flatFor(url(1))!.deleted).not.toBeNull();
  expect(flatFor(url(2))!.deleted).not.toBeNull();
});
