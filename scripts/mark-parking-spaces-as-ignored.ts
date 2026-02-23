import { db } from "../server/db/client";
import { flat as flatTable } from "../server/db/schema";
import { eq } from "drizzle-orm";
import { isParkingSpace } from "../lib/flat-utils";

async function markParkingSpacesAsIgnored() {
  console.log("Fetching all flats...");

  const allFlats = await db.query.flat.findMany({
    where: eq(flatTable.ignored, false),
  });

  console.log(`Found ${allFlats.length} non-ignored flats`);

  let updatedCount = 0;

  for (const flat of allFlats) {
    if (isParkingSpace(flat.title)) {
      await db
        .update(flatTable)
        .set({ ignored: true })
        .where(eq(flatTable.id, flat.id));

      console.log(`Marked as ignored: ${flat.title}`);
      updatedCount++;
    }
  }

  console.log(`\nDone! Marked ${updatedCount} parking spaces as ignored.`);
}

markParkingSpacesAsIgnored().catch(console.error);
