import { propertyManagements } from "~/data/propertyManagements";
import { logScraperRun } from "~/server/lib/scraper/log-scraper-run";
import { pruneFlatsNotSeenForDays } from "~/server/lib/scraper/prune-stale-flats";
import { runScraper } from "~/server/lib/scraper/live";
import {
  emptySyncStats,
  syncListingsReport,
} from "~/server/lib/scraper/sync-listings";
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
          stats: emptySyncStats(),
        },
      };
    }

    console.log(`[task:update-flats] Processing ${propertyManagementId}`);

    const { success, stats, error } = await runScraper(
      syncListingsReport(propertyManagementId),
    );

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
