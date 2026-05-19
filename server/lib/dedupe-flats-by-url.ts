import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  flat as flatTable,
  flatToTag as flatToTagTable,
} from "~/server/db/schema";

export async function dedupeFlatsByUrl(): Promise<number> {
  const duplicateUrls = await db
    .select({ url: flatTable.url })
    .from(flatTable)
    .groupBy(flatTable.url)
    .having(sql`count(*) > 1`);

  if (duplicateUrls.length === 0) {
    return 0;
  }

  console.log(
    `[dedupe-flats-by-url] Found ${duplicateUrls.length} URLs with duplicate flats`,
  );

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

  return removed;
}
