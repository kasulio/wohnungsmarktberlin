import { and, asc, count, eq, inArray, lt, sql } from "drizzle-orm";
import { Clock, Data, Duration, Effect, Random } from "effect";
import { z } from "zod";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { scrapedFlatSchema } from "~/data/schemas";
import { makeThumbnail, shouldIgnoreListing } from "~/lib/flat-utils";
import { type FetchError, Http } from "~/lib/http";
import { flat as flatTable, flatUrlJob } from "~/server/db/schema";
import { type DbError, query } from "~/server/db/service";
import {
  AddressImprovement,
  ExtractPacing,
  scraperFor,
  type UnknownScraperError,
} from "./services";

export type ExtractStats = {
  flatsExtracted: number;
  flatsFailed: number;
  flatsPending: number;
};

export type ExtractOptions = {
  limit: number;
  propertyManagementIds?: PropertyManagementId[];
  pace: "background" | "interactive";
  /** Jobs queued longer ago than this are dropped first; 0 keeps them. Default 3. */
  pruneJobsOlderThanDays?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type FlatUrlJob = typeof flatUrlJob.$inferSelect;

export class ParseError extends Data.TaggedError("ParseError")<{
  url: string;
  message: string;
}> {
  static from(url: string, cause: unknown) {
    const detail =
      cause instanceof z.ZodError
        ? cause.issues
            .map(
              (issue) =>
                `${issue.path.join(".") || "(root)"}: ${issue.message}`,
            )
            .join("; ")
        : cause instanceof Error
          ? cause.message
          : String(cause);
    return new ParseError({ url, message: `Listing did not parse: ${detail}` });
  }
}

type JobError = UnknownScraperError | FetchError | ParseError | DbError;

/** What `flatUrlJob.lastError` holds: the error's message, capped. */
const describe = (error: JobError) => error.message.slice(0, 500);

const byCompany = (ids: PropertyManagementId[] | undefined) =>
  ids && ids.length > 0
    ? and(
        eq(flatUrlJob.status, "pending"),
        inArray(flatUrlJob.propertyManagementId, ids),
      )
    : eq(flatUrlJob.status, "pending");

/** A missing image never fails the job. */
const loadThumbnail = (url: string) =>
  Effect.gen(function* () {
    const http = yield* Http;
    const bytes = yield* http.bytes({ url });
    return yield* Effect.tryPromise(() => makeThumbnail(bytes));
  }).pipe(
    Effect.catch((error) =>
      Effect.logWarning(`no image from ${url}: ${error.message}`).pipe(
        Effect.as(null),
      ),
    ),
  );

const extractJob = (job: FlatUrlJob) =>
  Effect.gen(function* () {
    const scraper = yield* scraperFor(job.propertyManagementId);
    const http = yield* Http;
    const html = yield* http.text({
      url: job.url,
      ...scraper.getFetchOptions?.(),
    });
    const scraped = yield* Effect.try({
      try: () =>
        scrapedFlatSchema.parse(scraper.extractDataFromHtml(html, job.url)),
      catch: (cause) => ParseError.from(job.url, cause),
    });
    const image = scraped.imageUrl
      ? yield* loadThumbnail(scraped.imageUrl)
      : null;
    const ignored = shouldIgnoreListing({
      ...scraped,
      propertyManagementId: job.propertyManagementId,
    });
    const now = new Date(yield* Clock.currentTimeMillis);
    const fields = {
      url: scraped.url,
      propertyManagementId: job.propertyManagementId,
      title: scraped.title,
      addressText: scraped.addressText,
      coldRentPrice: scraped.coldRentPrice,
      warmRentPrice: scraped.warmRentPrice,
      roomCount: scraped.roomCount,
      usableArea: scraped.usableArea,
      floor: scraped.floor,
      image,
      lastSeen: now,
      deleted: null,
      ignored,
    };
    yield* query("save flat", (db) =>
      db.transaction(async (tx) => {
        await tx
          .insert(flatTable)
          .values({ ...fields, firstSeen: now })
          .onConflictDoUpdate({ target: flatTable.url, set: fields });
        await tx
          .update(flatUrlJob)
          .set({ status: "completed", lastError: null })
          .where(eq(flatUrlJob.url, job.url));
      }),
    );
  });

const markFailed = (job: FlatUrlJob, error: JobError) =>
  Effect.gen(function* () {
    yield* Effect.logWarning(`failed ${job.url}: ${error.message}`);
    yield* query("mark job failed", (db) =>
      db
        .update(flatUrlJob)
        .set({
          status: "failed",
          lastError: describe(error),
          attempts: sql`${flatUrlJob.attempts} + 1`,
        })
        .where(eq(flatUrlJob.url, job.url)),
    );
  });

const pruneOldJobs = (days: number) =>
  Effect.gen(function* () {
    if (days <= 0) return;
    const cutoff = new Date(
      (yield* Clock.currentTimeMillis) - days * MS_PER_DAY,
    );
    const removed = yield* query("prune old jobs", (db) =>
      db
        .delete(flatUrlJob)
        .where(lt(flatUrlJob.createdAt, cutoff))
        .returning({ url: flatUrlJob.url }),
    );
    if (removed.length > 0) {
      yield* Effect.log(
        `removed ${removed.length} jobs older than ${days} days`,
      );
    }
  });

const backgroundPause = Effect.gen(function* () {
  const { background } = yield* ExtractPacing;
  const millis = yield* Random.nextBetween(
    background.minMillis,
    background.maxMillis,
  );
  yield* Effect.sleep(Duration.millis(millis));
});

/** Extracts one job; a failure lands on the job instead of failing the run. */
const runJob = (job: FlatUrlJob) =>
  extractJob(job).pipe(
    Effect.as(true),
    Effect.catch((error) => markFailed(job, error).pipe(Effect.as(false))),
  );

export const extractFlats = (options: ExtractOptions) =>
  Effect.gen(function* () {
    yield* pruneOldJobs(options.pruneJobsOlderThanDays ?? 3);
    const jobs = yield* query("load pending jobs", (db) =>
      db
        .select()
        .from(flatUrlJob)
        .where(byCompany(options.propertyManagementIds))
        .orderBy(asc(flatUrlJob.createdAt))
        .limit(options.limit),
    );
    const outcomes = yield* Effect.forEach(
      Object.values(Object.groupBy(jobs, (job) => job.propertyManagementId)),
      (companyJobs) =>
        Effect.forEach(companyJobs ?? [], (job, i) =>
          i > 0 && options.pace === "background"
            ? Effect.andThen(backgroundPause, runJob(job))
            : runJob(job),
        ),
      { concurrency: "unbounded" },
    );
    const flatsExtracted = outcomes.flat().filter((ok) => ok).length;
    const flatsFailed = jobs.length - flatsExtracted;
    if (flatsExtracted > 0) {
      // Geocode → notify right away; the cron task is the safety net if this fails.
      const addressImprovement = yield* AddressImprovement;
      yield* Effect.tryPromise(() => addressImprovement.run()).pipe(
        Effect.catch((error) =>
          Effect.logError("post-extract address improvement failed", error),
        ),
      );
    }
    const [pending] = yield* query("count pending jobs", (db) =>
      db
        .select({ n: count() })
        .from(flatUrlJob)
        .where(byCompany(options.propertyManagementIds)),
    );
    return {
      flatsExtracted,
      flatsFailed,
      flatsPending: pending?.n ?? 0,
    } satisfies ExtractStats;
  });
