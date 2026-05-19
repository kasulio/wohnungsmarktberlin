import { db } from "../server/db/client";
import { flat as flatTable } from "../server/db/schema";
import { eq } from "drizzle-orm";
import { shouldIgnoreListing } from "../lib/flat-utils";

async function markNonResidentialAsIgnored() {
  console.log("Fetching non-ignored flats...");

  const flats = await db.query.flat.findMany({
    where: eq(flatTable.ignored, false),
  });

  console.log(`Checking ${flats.length} flats`);

  let updatedCount = 0;

  for (const flat of flats) {
    if (!shouldIgnoreListing(flat)) continue;

    await db
      .update(flatTable)
      .set({ ignored: true })
      .where(eq(flatTable.id, flat.id));

    console.log(`Marked as ignored: ${flat.title}`);
    updatedCount++;
  }

  console.log(`\nDone! Marked ${updatedCount} listings as ignored.`);
}

markNonResidentialAsIgnored().catch(console.error);
