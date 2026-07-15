import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { and, asc, count, eq, inArray, lt, sql } from "drizzle-orm";
import { fetchHtml } from "~/lib/http";
import { scrapedFlatSchema } from "~/data/schemas";
import {
  getPropertyManagement,
  getImage,
  shouldIgnoreListing,
} from "~/lib/flat-utils";
import { db } from "~/server/db/client";
import {
  flat as flatTable,
  flatUrlJob as flatUrlJobTable,
} from "~/server/db/schema";

export type ProcessFlatUrlJobsStats = {
  flatsExtracted: number;
  flatsFailed: number;
  flatsPending: number;
};

type ProcessOptions = {
  limit: number;
  propertyManagementIds?: PropertyManagementId[];
  sleepBetweenJobs: boolean;
  pruneJobsOlderThanDays?: number;
};

export async function processFlatUrlJobs(
  options: ProcessOptions,
): Promise<{ stats: ProcessFlatUrlJobsStats }> {
  const stats: ProcessFlatUrlJobsStats = {
    flatsExtracted: 0,
    flatsFailed: 0,
    flatsPending: 0,
  };

  const pruneDays = options.pruneJobsOlderThanDays ?? 3;
  if (pruneDays > 0) {
    const cutoff = new Date(Date.now() - pruneDays * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(flatUrlJobTable)
      .where(lt(flatUrlJobTable.createdAt, cutoff))
      .returning({ url: flatUrlJobTable.url });
    if (deleted.length > 0) {
      console.log(
        `[process-flat-url-jobs] removed ${deleted.length} jobs older than ${pruneDays} days`,
      );
    }
  }

  const pendingWhere =
    options.propertyManagementIds && options.propertyManagementIds.length > 0
      ? and(
          eq(flatUrlJobTable.status, "pending"),
          inArray(
            flatUrlJobTable.propertyManagementId,
            options.propertyManagementIds,
          ),
        )
      : eq(flatUrlJobTable.status, "pending");

  const flatUrlJobs = await db
    .select()
    .from(flatUrlJobTable)
    .where(pendingWhere)
    .orderBy(asc(flatUrlJobTable.createdAt))
    .limit(options.limit);

  if (flatUrlJobs.length === 0) {
    stats.flatsPending = await pendingCount();
    return { stats };
  }

  for (const flatUrlJob of flatUrlJobs) {
    const propertyManagement = getPropertyManagement(
      flatUrlJob.propertyManagementId,
    );

    try {
      const html = await fetchHtml(
        flatUrlJob.url,
        propertyManagement.getFetchOptions?.(),
      );
      const scrapedFlat = propertyManagement.extractDataFromHtml(
        html,
        flatUrlJob.url,
      );

      const flat = scrapedFlatSchema.parse(scrapedFlat);

      const image = flat.imageUrl ? await getImage(flat.imageUrl) : null;
      const shouldIgnore = shouldIgnoreListing({
        ...flat,
        propertyManagementId: flatUrlJob.propertyManagementId,
      });

      console.log(
        `[process-flat-url-jobs] extracted flat ${flat.url}${shouldIgnore ? " (ignored)" : ""}`,
      );
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .insert(flatTable)
          .values({
            addressText: flat.addressText,
            coldRentPrice: flat.coldRentPrice,
            floor: flat.floor,
            propertyManagementId: flatUrlJob.propertyManagementId,
            roomCount: flat.roomCount,
            title: flat.title,
            usableArea: flat.usableArea,
            warmRentPrice: flat.warmRentPrice,
            lastSeen: now,
            firstSeen: now,
            url: flat.url,
            image: image,
            deleted: null,
            ignored: shouldIgnore,
          })
          .onConflictDoUpdate({
            target: flatTable.url,
            set: {
              addressText: flat.addressText,
              coldRentPrice: flat.coldRentPrice,
              floor: flat.floor,
              propertyManagementId: flatUrlJob.propertyManagementId,
              roomCount: flat.roomCount,
              title: flat.title,
              usableArea: flat.usableArea,
              warmRentPrice: flat.warmRentPrice,
              lastSeen: now,
              image: image,
              deleted: null,
              ignored: shouldIgnore,
            },
          })
          .execute();

        await tx
          .update(flatUrlJobTable)
          .set({ status: "completed", lastError: null })
          .where(eq(flatUrlJobTable.url, flatUrlJob.url))
          .execute();
      });
      stats.flatsExtracted++;
    } catch (e) {
      // No max-attempts cap: job stays `failed` until operator retries or row pruned.
      console.error(
        `[process-flat-url-jobs] failed to extract flat ${flatUrlJob.url}:`,
        e,
      );
      const lastError = (e instanceof Error ? e.message : String(e)).slice(
        0,
        500,
      );
      await db
        .update(flatUrlJobTable)
        .set({
          status: "failed",
          lastError,
          attempts: sql`(coalesce(${flatUrlJobTable.attempts}, 0) + 1)`,
        })
        .where(eq(flatUrlJobTable.url, flatUrlJob.url))
        .execute();
      stats.flatsFailed++;
    }

    if (options.sleepBetweenJobs) {
      await Bun.sleep(1000 + Math.random() * 5000);
    }
  }

  stats.flatsPending = await pendingCount();
  return { stats };
}

async function pendingCount(): Promise<number> {
  const row = await db
    .select({ count: count() })
    .from(flatUrlJobTable)
    .where(eq(flatUrlJobTable.status, "pending"))
    .execute()
    .then((res) => res[0]);
  return row?.count ?? 0;
}
