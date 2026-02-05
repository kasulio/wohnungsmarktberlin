import { db } from "~/server/db/client";
import { flat, flatUrlJob } from "~/server/db/schema";
import {
  and,
  eq,
  inArray,
  InferInsertModel,
  isNull,
  lte,
  isNotNull,
} from "drizzle-orm";
import { propertyManagements } from "~/data/propertyManagements";

let lastIndex = 0;

export default defineTask({
  meta: {
    name: "update-flats",
    description:
      "Synchronize flats from property management websites by extracting URLs, marking deleted flats, and creating jobs for new listings",
  },
  run: async () => {
    const result = {
      success: true,
      stats: {
        existingActiveFlats: 0,
        extractedUrls: 0,
        flatsDeleted: 0,
        newJobsCreated: 0,
        flatsUpdated: 0,
        duplicateJobsFiltered: 0,
        jobsReset: 0,
      },
    };

    // Set all flats that have not been seen in the last 7 days to deleted
    await db
      .update(flat)
      .set({ deleted: new Date() })
      .where(
        and(
          isNotNull(flat.lastSeen),
          lte(flat.lastSeen, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        ),
      );

    // Select property management using round-robin based on current minute
    const currentMinute = new Date().getMinutes();
    const index = lastIndex++ % Object.values(propertyManagements).length;
    // const index = 1;
    const propertyManagement = Object.values(propertyManagements)[index];

    // No property management selected for this minute index, skip
    if (!propertyManagement) return { result };

    console.log(`[task:update-flats] Processing ${propertyManagement.slug}`);

    try {
      // Fetch existing active flats from database
      const existingActiveFlats = await db
        .select({
          url: flat.url,
          flatId: flat.id,
        })
        .from(flat)
        .where(
          and(
            eq(flat.propertyManagementId, propertyManagement.slug),
            isNull(flat.deleted),
          ),
        );

      result.stats.existingActiveFlats = existingActiveFlats.length;

      // Extract URLs from property management website
      const extractedUrls = await propertyManagement.extractUrls();
      result.stats.extractedUrls = extractedUrls.length;

      // Check existing jobs for extracted URLs and reset to pending if no matching flat exists
      if (extractedUrls.length > 0) {
        const existingJobsForExtractedUrls = await db
          .select({
            url: flatUrlJob.url,
            status: flatUrlJob.status,
          })
          .from(flatUrlJob)
          .where(
            and(
              eq(flatUrlJob.propertyManagementId, propertyManagement.slug),
              inArray(flatUrlJob.url, extractedUrls),
            ),
          );

        // Find jobs that don't have a corresponding active flat
        const jobsToReset = existingJobsForExtractedUrls.filter(
          (job) =>
            !existingActiveFlats.some((f) => f.url === job.url) &&
            job.status !== "pending",
        );

        if (jobsToReset.length > 0) {
          await db
            .update(flatUrlJob)
            .set({ status: "pending" })
            .where(
              and(
                eq(flatUrlJob.propertyManagementId, propertyManagement.slug),
                inArray(
                  flatUrlJob.url,
                  jobsToReset.map((job) => job.url),
                ),
              ),
            );

          result.stats.jobsReset = jobsToReset.length;
          console.log(
            `[task:update-flats] Reset ${jobsToReset.length} jobs to pending`,
          );
        }
      }

      // Mark flats as deleted if they no longer appear in extracted URLs
      const flatIdsToDelete = existingActiveFlats
        .filter((f) => !extractedUrls.includes(f.url))
        .map((f) => f.flatId);

      if (flatIdsToDelete.length > 0) {
        await db
          .update(flat)
          .set({ deleted: new Date() })
          .where(inArray(flat.id, flatIdsToDelete));

        result.stats.flatsDeleted = flatIdsToDelete.length;
      }

      // Create new jobs for URLs that don't exist in database or job table
      const newUrls = extractedUrls.filter(
        (url) => !existingActiveFlats.some((f) => f.url === url),
      );

      if (newUrls.length > 0) {
        // Query existing jobs to prevent duplicates
        const existingJobs = await db
          .select({
            url: flatUrlJob.url,
          })
          .from(flatUrlJob)
          .where(
            and(
              eq(flatUrlJob.propertyManagementId, propertyManagement.slug),
              inArray(flatUrlJob.url, newUrls),
            ),
          );

        const existingJobUrls = new Set(existingJobs.map((job) => job.url));
        const urlsToInsert = newUrls.filter((url) => !existingJobUrls.has(url));

        result.stats.duplicateJobsFiltered =
          newUrls.length - urlsToInsert.length;

        if (urlsToInsert.length > 0) {
          const flatUrlJobsToInsert = urlsToInsert.map(
            (url) =>
              ({
                url,
                propertyManagementId: propertyManagement.slug,
                createdAt: new Date(),
                status: "pending",
              }) satisfies InferInsertModel<typeof flatUrlJob>,
          );

          console.log(`[task:update-flats] New URLs:`, urlsToInsert);
          await db.insert(flatUrlJob).values(flatUrlJobsToInsert);
          result.stats.newJobsCreated = flatUrlJobsToInsert.length;
        }
      }

      // Update lastSeen timestamp for flats that are still active
      const activeFlatsStillListed = existingActiveFlats.filter((f) =>
        extractedUrls.includes(f.url),
      );

      if (activeFlatsStillListed.length > 0) {
        await db
          .update(flat)
          .set({ lastSeen: new Date() })
          .where(
            and(
              eq(flat.propertyManagementId, propertyManagement.slug),
              isNull(flat.deleted),
              inArray(
                flat.id,
                activeFlatsStillListed.map((f) => f.flatId),
              ),
            ),
          );

        result.stats.flatsUpdated = activeFlatsStillListed.length;
      }
    } catch (e) {
      console.error(e);
      result.success = false;
    }

    console.log(
      `[task:update-flats] ${result.stats.flatsDeleted} deleted, ${result.stats.newJobsCreated} new jobs, ${result.stats.duplicateJobsFiltered} duplicates filtered, ${result.stats.flatsUpdated} updated, ${result.stats.jobsReset} jobs reset to pending`,
    );

    return { result };
  },
});
