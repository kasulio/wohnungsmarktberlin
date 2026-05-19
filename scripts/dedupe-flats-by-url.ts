import { eq, sql } from "drizzle-orm";
import { db } from "../server/db/client";
import {
  flat as flatTable,
  flatToTag as flatToTagTable,
} from "../server/db/schema";

const dryRun = process.argv.includes("--dry-run");

async function dedupeFlatsByUrl() {
  const duplicateUrls = await db
    .select({ url: flatTable.url })
    .from(flatTable)
    .groupBy(flatTable.url)
    .having(sql`count(*) > 1`);

  console.log(`Found ${duplicateUrls.length} URLs with duplicate flats`);
  if (dryRun) {
    console.log("Dry run — no changes will be written");
  }

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

    if (dryRun) {
      console.log(`\n${url}`);
      console.log(
        `  keep: ${keeper.id} (lastSeen=${keeper.lastSeen?.toISOString()}, ignored=${keeper.ignored})`,
      );
      for (const loser of losers) {
        const tags = await db
          .select()
          .from(flatToTagTable)
          .where(eq(flatToTagTable.flatId, loser.id));
        console.log(
          `  delete: ${loser.id} (lastSeen=${loser.lastSeen?.toISOString()}, ignored=${loser.ignored}, tags=${tags.length})`,
        );
        removed++;
      }
      if (wouldSetIgnored) {
        console.log(`  would set keeper ${keeper.id} ignored=true`);
      }
      continue;
    }

    await db.transaction(async (tx) => {
      for (const loser of losers) {
        const tags = await tx
          .select()
          .from(flatToTagTable)
          .where(eq(flatToTagTable.flatId, loser.id));

        for (const { tagId } of tags) {
          await tx
            .insert(flatToTagTable)
            .values({ flatId: keeper.id, tagId })
            .onConflictDoNothing();
        }

        await tx
          .delete(flatToTagTable)
          .where(eq(flatToTagTable.flatId, loser.id));

        await tx.delete(flatTable).where(eq(flatTable.id, loser.id));
        removed++;
      }

      if (wouldSetIgnored) {
        await tx
          .update(flatTable)
          .set({ ignored: true })
          .where(eq(flatTable.id, keeper.id));
      }
    });
  }

  console.log(
    dryRun
      ? `\nWould remove ${removed} duplicate flat rows`
      : `\nRemoved ${removed} duplicate flat rows`,
  );
}

dedupeFlatsByUrl().catch(console.error);
