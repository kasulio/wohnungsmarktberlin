import { Effect } from "effect";
import { extractFlats } from "~/server/lib/scraper/extract-flats";
import { runScraper } from "~/server/lib/scraper/live";
import { loggedRun } from "~/server/lib/scraper/run-log";

export default defineTask({
  meta: {
    name: "extract-flats",
    description: "Extract flats from the oldest pending listing URL jobs",
  },
  run: async () => {
    const result = await runScraper(
      loggedRun(
        { kind: "extract-flats", trigger: "scheduled" },
        extractFlats({ limit: 10, pace: "background" }).pipe(
          Effect.map((stats) => ({ success: stats.flatsFailed === 0, stats })),
        ),
      ),
    );
    const { stats } = result;
    console.log(
      `[task:extract-flats] extracted ${stats.flatsExtracted} flats, failed ${stats.flatsFailed} flats, pending ${stats.flatsPending} flats`,
    );
    return { result };
  },
});
