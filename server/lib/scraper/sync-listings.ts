import {
  and,
  eq,
  inArray,
  type InferInsertModel,
  isNull,
} from "drizzle-orm";
import { propertyManagements } from "~/data/propertyManagements";
import { db } from "~/server/db/client";
import { flat, flatUrlJob } from "~/server/db/schema";

export type SyncListingsStats = {
  existingActiveFlats: number;
  extractedUrls: number;
  flatsDeleted: number;
  newJobsCreated: number;
  flatsUpdated: number;
  duplicateJobsFiltered: number;
  jobsReset: number;
};

const emptyStats = (): SyncListingsStats => ({
  existingActiveFlats: 0,
  extractedUrls: 0,
  flatsDeleted: 0,
  newJobsCreated: 0,
  flatsUpdated: 0,
  duplicateJobsFiltered: 0,
  jobsReset: 0,
});

export async function syncListingsForPropertyManagement(
  slug: string,
): Promise<{ success: boolean; stats: SyncListingsStats; error?: string }> {
  const stats = emptyStats();
  const propertyManagement =
    propertyManagements[slug as keyof typeof propertyManagements];

  if (!propertyManagement) {
    return {
      success: false,
      stats,
      error: `Unknown property management: ${slug}`,
    };
  }

  try {
    const existingActiveFlats = await db
      .select({
        url: flat.url,
        flatId: flat.id,
      })
      .from(flat)
      .where(
        and(eq(flat.propertyManagementId, slug), isNull(flat.deleted)),
      );

    stats.existingActiveFlats = existingActiveFlats.length;

    const extractedUrls = await propertyManagement.extractUrls();
    stats.extractedUrls = extractedUrls.length;

    if (extractedUrls.length > 0) {
      const existingJobsForExtractedUrls = await db
        .select({
          url: flatUrlJob.url,
          status: flatUrlJob.status,
        })
        .from(flatUrlJob)
        .where(
          and(
            eq(flatUrlJob.propertyManagementId, slug),
            inArray(flatUrlJob.url, extractedUrls),
          ),
        );

      const jobsToReset = existingJobsForExtractedUrls.filter(
        (job) =>
          !existingActiveFlats.some((f) => f.url === job.url) &&
          job.status !== "pending",
      );

      if (jobsToReset.length > 0) {
        await db
          .update(flatUrlJob)
          .set({ status: "pending", createdAt: new Date() })
          .where(
            and(
              eq(flatUrlJob.propertyManagementId, slug),
              inArray(
                flatUrlJob.url,
                jobsToReset.map((job) => job.url),
              ),
            ),
          );

        stats.jobsReset = jobsToReset.length;
      }
    }

    const flatIdsToDelete = existingActiveFlats
      .filter((f) => !extractedUrls.includes(f.url))
      .map((f) => f.flatId);

    if (flatIdsToDelete.length > 0) {
      await db
        .update(flat)
        .set({ deleted: new Date() })
        .where(inArray(flat.id, flatIdsToDelete));

      stats.flatsDeleted = flatIdsToDelete.length;
    }

    const newUrls = extractedUrls.filter(
      (url) => !existingActiveFlats.some((f) => f.url === url),
    );

    if (newUrls.length > 0) {
      const existingJobs = await db
        .select({
          url: flatUrlJob.url,
        })
        .from(flatUrlJob)
        .where(
          and(
            eq(flatUrlJob.propertyManagementId, slug),
            inArray(flatUrlJob.url, newUrls),
          ),
        );

      const existingJobUrls = new Set(existingJobs.map((job) => job.url));
      const urlsToInsert = newUrls.filter((url) => !existingJobUrls.has(url));

      stats.duplicateJobsFiltered = newUrls.length - urlsToInsert.length;

      if (urlsToInsert.length > 0) {
        const flatUrlJobsToInsert = urlsToInsert.map(
          (url) =>
            ({
              url,
              propertyManagementId: slug,
              createdAt: new Date(),
              status: "pending",
            }) satisfies InferInsertModel<typeof flatUrlJob>,
        );

        await db.insert(flatUrlJob).values(flatUrlJobsToInsert);
        stats.newJobsCreated = flatUrlJobsToInsert.length;
      }
    }

    const activeFlatsStillListed = existingActiveFlats.filter((f) =>
      extractedUrls.includes(f.url),
    );

    if (activeFlatsStillListed.length > 0) {
      await db
        .update(flat)
        .set({ lastSeen: new Date() })
        .where(
          and(
            eq(flat.propertyManagementId, slug),
            isNull(flat.deleted),
            inArray(
              flat.id,
              activeFlatsStillListed.map((f) => f.flatId),
            ),
          ),
        );

      stats.flatsUpdated = activeFlatsStillListed.length;
    }

    return { success: true, stats };
  } catch (e) {
    console.error(`[sync-listings] ${slug}`, e);
    return {
      success: false,
      stats,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
