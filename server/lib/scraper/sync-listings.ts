import { and, eq, inArray, isNull } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { flat, flatUrlJob } from "~/server/db/schema";
import { query } from "~/server/db/service";
import { scraperFor } from "./services";

export type SyncListingsStats = {
  existingActiveFlats: number;
  extractedUrls: number;
  flatsDeleted: number;
  newJobsCreated: number;
  flatsUpdated: number;
  duplicateJobsFiltered: number;
  jobsReset: number;
};

export const emptySyncStats = (): SyncListingsStats => ({
  existingActiveFlats: 0,
  extractedUrls: 0,
  flatsDeleted: 0,
  newJobsCreated: 0,
  flatsUpdated: 0,
  duplicateJobsFiltered: 0,
  jobsReset: 0,
});

export class ListingsError extends Data.TaggedError("ListingsError")<{
  propertyManagementId: string;
  cause: unknown;
  message: string;
}> {}

const listUrls = (propertyManagementId: PropertyManagementId) =>
  Effect.gen(function* () {
    const scraper = yield* scraperFor(propertyManagementId);
    const urls = yield* Effect.tryPromise({
      try: () => scraper.extractUrls(),
      catch: (cause) =>
        new ListingsError({
          propertyManagementId,
          cause,
          message: `Could not list ${propertyManagementId}: ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
    });
    return [...new Set(urls)];
  });

/**
 * Brings the DB in line with a company's current listing page: queues jobs for
 * new urls, soft-deletes flats no longer listed, refreshes `lastSeen` of the
 * rest. Nothing is written when listing fails.
 */
export const syncListings = (propertyManagementId: PropertyManagementId) =>
  Effect.gen(function* () {
    const urls = yield* listUrls(propertyManagementId);
    const now = new Date(yield* Clock.currentTimeMillis);

    return yield* query("sync listings", async (db) =>
      db.transaction((tx) => {
        const listed = new Set(urls);
        const activeFlats = tx
          .select({ id: flat.id, url: flat.url })
          .from(flat)
          .where(
            and(
              eq(flat.propertyManagementId, propertyManagementId),
              isNull(flat.deleted),
            ),
          )
          .all();
        const activeUrls = new Set(activeFlats.map((f) => f.url));
        const stillListed = activeFlats.filter((f) => listed.has(f.url));
        const gone = activeFlats.filter((f) => !listed.has(f.url));
        const newUrls = urls.filter((url) => !activeUrls.has(url));

        const knownJobs =
          newUrls.length > 0
            ? tx
                .select({ url: flatUrlJob.url, status: flatUrlJob.status })
                .from(flatUrlJob)
                .where(
                  and(
                    eq(flatUrlJob.propertyManagementId, propertyManagementId),
                    inArray(flatUrlJob.url, newUrls),
                  ),
                )
                .all()
            : [];
        const knownJobUrls = new Set(knownJobs.map((j) => j.url));
        const jobsToReset = knownJobs
          .filter((j) => j.status !== "pending")
          .map((j) => j.url);
        const urlsToQueue = newUrls.filter((url) => !knownJobUrls.has(url));

        if (jobsToReset.length > 0) {
          tx.update(flatUrlJob)
            .set({ status: "pending", createdAt: now })
            .where(
              and(
                eq(flatUrlJob.propertyManagementId, propertyManagementId),
                inArray(flatUrlJob.url, jobsToReset),
              ),
            )
            .run();
        }
        if (gone.length > 0) {
          tx.update(flat)
            .set({ deleted: now })
            .where(
              inArray(
                flat.id,
                gone.map((f) => f.id),
              ),
            )
            .run();
        }
        if (urlsToQueue.length > 0) {
          tx.insert(flatUrlJob)
            .values(
              urlsToQueue.map((url) => ({
                url,
                propertyManagementId,
                createdAt: now,
                status: "pending" as const,
              })),
            )
            .run();
        }
        if (stillListed.length > 0) {
          tx.update(flat)
            .set({ lastSeen: now })
            .where(
              inArray(
                flat.id,
                stillListed.map((f) => f.id),
              ),
            )
            .run();
        }

        return {
          existingActiveFlats: activeFlats.length,
          extractedUrls: urls.length,
          flatsDeleted: gone.length,
          newJobsCreated: urlsToQueue.length,
          flatsUpdated: stillListed.length,
          duplicateJobsFiltered: newUrls.length - urlsToQueue.length,
          jobsReset: jobsToReset.length,
        } satisfies SyncListingsStats;
      }),
    );
  });

export type SyncReport = {
  success: boolean;
  stats: SyncListingsStats;
  error?: string;
};

/** `syncListings` as a report that never fails, for run logs and the admin payload. */
export const syncListingsReport = (
  propertyManagementId: PropertyManagementId,
): Effect.Effect<
  SyncReport,
  never,
  Effect.Services<ReturnType<typeof syncListings>>
> =>
  syncListings(propertyManagementId).pipe(
    Effect.map((stats) => ({ success: true, stats })),
    Effect.catch((error) =>
      Effect.logError(
        `sync ${propertyManagementId} failed: ${error.message}`,
      ).pipe(
        Effect.as({
          success: false,
          stats: emptySyncStats(),
          error: error.message,
        }),
      ),
    ),
  );
