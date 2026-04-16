import { and, asc, count, eq, inArray, lt } from "drizzle-orm";
import { fetchHtml } from "~/lib/http";
import { scrapedFlatSchema } from "~/data/schemas";
import {
  getPropertyManagement,
  getImage,
  isParkingSpace,
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
  propertyManagementIds?: string[];
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
      const html = await fetchHtml(flatUrlJob.url);
      const scrapedFlat = propertyManagement.extractDataFromHtml(
        html,
        flatUrlJob.url,
      );

      const flat = scrapedFlatSchema.parse(scrapedFlat);

      const image = flat.imageUrl ? await getImage(flat.imageUrl) : null;
      const ignored = isParkingSpace({
        ...flat,
        propertyManagementId: flatUrlJob.propertyManagementId,
      });

      console.log(
        `[process-flat-url-jobs] extracted flat ${flat.url}${ignored ? " (ignored)" : ""}`,
      );
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
            lastSeen: new Date(),
            firstSeen: new Date(),
            url: flat.url,
            image: image,
            deleted: null,
            ignored,
          })
          .onConflictDoNothing()
          .execute();

        await tx
          .update(flatUrlJobTable)
          .set({ status: "completed" })
          .where(eq(flatUrlJobTable.url, flatUrlJob.url))
          .execute();
      });
      stats.flatsExtracted++;
    } catch (e) {
      console.error(
        `[process-flat-url-jobs] failed to extract flat ${flatUrlJob.url}:`,
        e,
      );
      await db
        .update(flatUrlJobTable)
        .set({ status: "failed" })
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
