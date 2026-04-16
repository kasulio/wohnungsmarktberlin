import { logScraperRun } from "~/server/lib/scraper/log-scraper-run";
import { processFlatUrlJobs } from "~/server/lib/scraper/process-flat-url-jobs";

export default defineTask({
  meta: {
    name: "extract-flats",
    description:
      "Extract flats from property management websites by extracting URLs",
  },
  run: async () => {
    const started = Date.now();
    const { stats } = await processFlatUrlJobs({
      limit: 10,
      sleepBetweenJobs: true,
    });

    const success = stats.flatsFailed === 0;

    console.log(
      `[task:extract-flats] extracted ${stats.flatsExtracted} flats, failed ${stats.flatsFailed} flats, pending ${stats.flatsPending} flats`,
    );

    await logScraperRun({
      kind: "extract-flats",
      propertyManagementId: null,
      success,
      stats,
      durationMs: Date.now() - started,
      trigger: "scheduled",
    });

    return { result: { success, stats } };
  },
});
