import { db } from "../server/db/client";
import { flat as flatTable } from "../server/db/schema";
import { eq, isNull } from "drizzle-orm";

function isParkingSpace(title: string): boolean {
  const parkingKeywords = [
    "parkplatz",
    "stellplatz",
    "garage",
    "tiefgarage",
    "außenstellplatz",
    "duplex-parker",
    "duplexparker",
    "pkw-stellplatz",
    "pkw stellplatz",
    "kfz-stellplatz",
    "kfz stellplatz",
  ];

  const lowerTitle = title.toLowerCase();

  // If parking is mentioned as an included feature (not the main listing), it's not a parking space
  const includePatterns = [
    "inklusive",
    "inkl.",
    "inkl ",
    "mit ",
    "incl.",
    "incl ",
    "+ ",
  ];

  // Check if any parking keyword appears in context of being included
  const hasIncludedParking = includePatterns.some((pattern) => {
    return parkingKeywords.some((keyword) => {
      const regex = new RegExp(
        `${pattern}.*${keyword}|${keyword}.*${pattern}`,
        "i",
      );
      return regex.test(lowerTitle);
    });
  });

  if (hasIncludedParking) {
    return false;
  }

  return parkingKeywords.some((keyword) => lowerTitle.includes(keyword));
}

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
