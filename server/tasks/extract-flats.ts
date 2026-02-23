import { count, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  flat as flatTable,
  flatUrlJob as flatUrlJobTable,
} from "~/server/db/schema";
import { fetchHtml } from "~/lib/http";
import { scrapedFlatSchema } from "~/data/schemas";
import {
  isParkingSpace,
  getPropertyManagement,
  getImage,
} from "~/lib/flat-utils";

export default defineTask({
  meta: {
    name: "extract-flats",
    description:
      "Extract flats from property management websites by extracting URLs",
  },
  run: async () => {
    const result = {
      success: true,
      stats: {
        flatsExtracted: 0,
        flatsFailed: 0,
        flatsPending: 0,
      },
    };

    const flatUrlJobs = await db
      .select()
      .from(flatUrlJobTable)
      .where(eq(flatUrlJobTable.status, "pending"))
      .limit(10);
    if (flatUrlJobs.length === 0) return { result };

    for (const flatUrlJob of flatUrlJobs) {
      const propertyManagement = getPropertyManagement(
        flatUrlJob.propertyManagementId,
      );

      const html = await fetchHtml(flatUrlJob.url);
      try {
        const scrapedFlat = propertyManagement.extractDataFromHtml(
          html,
          flatUrlJob.url,
        );

        const flat = scrapedFlatSchema.parse(scrapedFlat);

        const image = flat.imageUrl ? await getImage(flat.imageUrl) : null;
        const ignored = isParkingSpace(flat.title);

        console.log(
          `[task:extract-flats] extracted flat ${flat.url}${ignored ? " (parking space - ignored)" : ""}`,
        );
        await db.transaction(async (tx) => {
          await tx
            .insert(flatTable)
            .values({
              addressText: flat.addressText,
              coldRentPrice: flat.coldRentPrice,
              floor: flat.floor,
              propertyManagementId: flatUrlJob.propertyManagementId,
              roomCount: flat.roomCount,
              title: flat.title,
              usableArea: flat.usableArea,
              warmRentPrice: flat.warmRentPrice,
              lastSeen: new Date(),
              firstSeen: new Date(),
              url: flat.url,
              image: image,
              deleted: null,
              ignored,
            })
            .onConflictDoNothing()
            .execute();

          await tx
            .update(flatUrlJobTable)
            .set({ status: "completed" })
            .where(eq(flatUrlJobTable.url, flatUrlJob.url))
            .execute();
        });
        result.stats.flatsExtracted++;
      } catch (e) {
        console.error(e);
        result.stats.flatsFailed++;
      }

      await Bun.sleep(1000 + Math.random() * 5000);
    }

    result.stats.flatsPending = await db
      .select({ count: count() })
      .from(flatUrlJobTable)
      .where(eq(flatUrlJobTable.status, "pending"))
      .execute()
      .then((res) => res[0]?.count ?? 0);

    console.log(
      `[task:extract-flats] extracted ${result.stats.flatsExtracted} flats, failed ${result.stats.flatsFailed} flats, pending ${result.stats.flatsPending} flats`,
    );
    return { result };
  },
});
