import { dedupeFlatsByUrl } from "../server/lib/dedupe-flats-by-url";
import { eq, sql } from "drizzle-orm";
import { db } from "../server/db/client";
import { flat as flatTable } from "../server/db/schema";

const dryRun = process.argv.includes("--dry-run");

async function logDryRun() {
  const duplicateUrls = await db
    .select({ url: flatTable.url })
    .from(flatTable)
    .groupBy(flatTable.url)
    .having(sql`count(*) > 1`);

  console.log(`Found ${duplicateUrls.length} URLs with duplicate flats`);
  console.log("Dry run — no changes will be written");

  let removed = 0;

  for (const { url } of duplicateUrls) {
    const rows = await db.query.flat.findMany({
      where: eq(flatTable.url, url),
      orderBy: (flat, { desc }) => [desc(flat.lastSeen)],
    });

    const [keeper, ...losers] = rows;
    if (!keeper || losers.length === 0) continue;

    const mergedIgnored = rows.some((row) => row.ignored);
    const wouldSetIgnored = mergedIgnored && !keeper.ignored;

    console.log(`\n${url}`);
    console.log(
      `  keep: ${keeper.id} (lastSeen=${keeper.lastSeen?.toISOString()}, ignored=${keeper.ignored})`,
    );
    for (const loser of losers) {
      console.log(
        `  delete: ${loser.id} (lastSeen=${loser.lastSeen?.toISOString()}, ignored=${loser.ignored})`,
      );
      removed++;
    }
    if (wouldSetIgnored) {
      console.log(`  would set keeper ${keeper.id} ignored=true`);
    }
  }

  console.log(`\nWould remove ${removed} duplicate flat rows`);
}

async function main() {
  if (dryRun) {
    await logDryRun();
    return;
  }

  const removed = await dedupeFlatsByUrl();
  console.log(`Removed ${removed} duplicate flat rows`);
}

main().catch(console.error);
