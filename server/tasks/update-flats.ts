import { propertyManagements } from "~/data/propertyManagements";
import { PropertyManagementId } from "~/data/propertyManagements/configs";
import { logScraperRun } from "~/server/lib/scraper/log-scraper-run";
import { pruneFlatsNotSeenForDays } from "~/server/lib/scraper/prune-stale-flats";
import { syncListingsForPropertyManagement } from "~/server/lib/scraper/sync-listings";
import { typedObjectKeys } from "~/utils/typeHelper";

let lastIndex = 0;

export default defineTask({
  meta: {
    name: "update-flats",
    description:
      "Synchronize flats from property management websites by extracting URLs, marking deleted flats, and creating jobs for new listings",
  },
  run: async () => {
    const started = Date.now();
    await pruneFlatsNotSeenForDays(7);

    const index = lastIndex++ % Object.values(propertyManagements).length;
    const propertyManagementId = typedObjectKeys(propertyManagements)[index];

    if (!propertyManagementId) {
      return {
        result: {
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
        },
      };
    }

    console.log(`[task:update-flats] Processing ${propertyManagementId}`);

    const { success, stats, error } =
      await syncListingsForPropertyManagement(propertyManagementId);

    console.log(
      `[task:update-flats] ${stats.flatsDeleted} deleted, ${stats.newJobsCreated} new jobs, ${stats.duplicateJobsFiltered} duplicates filtered, ${stats.flatsUpdated} updated, ${stats.jobsReset} jobs reset to pending`,
    );

    await logScraperRun({
      kind: "update-flats",
      propertyManagementId,
      success,
      stats,
      errorMessage: error ?? null,
      durationMs: Date.now() - started,
      trigger: "scheduled",
    });

    return { result: { success, stats } };
  },
});
