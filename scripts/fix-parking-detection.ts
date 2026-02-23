import { db } from "../server/db/client";
import { flat as flatTable } from "../server/db/schema";
import { eq } from "drizzle-orm";

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
  // These patterns indicate the parking is an amenity, not the main item
  const includePatterns = [
    "inklusive",
    "inkl.",
    "inkl ",
    "incl.",
    "incl ",
    "wohnung mit",
    "zimmer mit",
    "& ",
  ];

  // Check if any include pattern appears BEFORE a parking keyword
  const hasIncludedParking = includePatterns.some((pattern) => {
    return parkingKeywords.some((keyword) => {
      // Escape special regex characters
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Look for pattern followed by parking keyword (with any characters in between)
      const regex = new RegExp(`${escapedPattern}.*${keyword}`, "i");
      return regex.test(lowerTitle);
    });
  });

  if (hasIncludedParking) {
    return false;
  }

  return parkingKeywords.some((keyword) => lowerTitle.includes(keyword));
}

async function fixParkingDetection() {
  console.log("Fetching all flats...");

  const allFlats = await db.query.flat.findMany();

  console.log(`Found ${allFlats.length} total flats`);

  let markedCount = 0;
  let unmarkedCount = 0;

  for (const flat of allFlats) {
    const shouldBeIgnored = isParkingSpace(flat.title);

    if (shouldBeIgnored && !flat.ignored) {
      // Should be ignored but isn't - mark it
      await db
        .update(flatTable)
        .set({ ignored: true })
        .where(eq(flatTable.id, flat.id));

      console.log(`Marked as ignored: ${flat.title}`);
      markedCount++;
    } else if (!shouldBeIgnored && flat.ignored) {
      // Shouldn't be ignored but is - unmark it (false positive)
      await db
        .update(flatTable)
        .set({ ignored: false })
        .where(eq(flatTable.id, flat.id));

      console.log(`Unmarked (apartment with parking): ${flat.title}`);
      unmarkedCount++;
    }
  }

  console.log(
    `\nDone! Marked ${markedCount} parking spaces as ignored, unmarked ${unmarkedCount} false positives.`,
  );
}

fixParkingDetection().catch(console.error);
