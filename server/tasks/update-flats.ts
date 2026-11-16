import { Effect } from "effect";
import { propertyManagements } from "~/data/propertyManagements";
import { runScraper } from "~/server/lib/scraper/live";
import { pruneStaleFlats } from "~/server/lib/scraper/prune-stale-flats";
import { loggedRun } from "~/server/lib/scraper/run-log";
import { syncListingsReport } from "~/server/lib/scraper/sync-listings";
import { typedObjectKeys } from "~/utils/typeHelper";

let lastIndex = 0;

export default defineTask({
  meta: {
    name: "update-flats",
    description:
      "Synchronize flats from property management websites by extracting URLs, marking deleted flats, and creating jobs for new listings",
  },
  run: async () => {
    const ids = typedObjectKeys(propertyManagements);
    const propertyManagementId = ids[lastIndex++ % ids.length]!;
    console.log(`[task:update-flats] Processing ${propertyManagementId}`);

    const { success, stats } = await runScraper(
      loggedRun(
        {
          kind: "update-flats",
          trigger: "scheduled",
          propertyManagementId,
        },
        Effect.gen(function* () {
          yield* pruneStaleFlats(7);
          const report = yield* syncListingsReport(propertyManagementId);
          return {
            success: report.success,
            stats: report.stats,
            errorMessage: report.error,
          };
        }),
      ),
    );

    console.log(
      `[task:update-flats] ${stats.flatsDeleted} deleted, ${stats.newJobsCreated} new jobs, ${stats.duplicateJobsFiltered} duplicates filtered, ${stats.flatsUpdated} updated, ${stats.jobsReset} jobs reset to pending`,
    );

    return { result: { success, stats } };
  },
});
