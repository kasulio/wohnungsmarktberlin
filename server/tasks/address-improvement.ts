import { db } from "~/server/db/client";
import { and, count, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { flat as flatTable, address as addressTable } from "~/server/db/schema";
import { getAddressFromPhoton } from "~/lib/photon";

export default defineTask({
  meta: {
    name: "address-improvement",
    description: "Improve the addresses of the flats",
  },
  run: async () => {
    const result = {
      success: true,
      stats: {
        addressesImproved: 0,
        addressesFailed: 0,
        addressesPending: 0,
      },
    };

    const flats = await db.query.flat.findMany({
      where: and(
        isNull(flatTable.addressId),
        isNotNull(flatTable.addressText),
        eq(flatTable.addressImprovement, "pending"),
      ),
      limit: 10,
      orderBy: [sql`random()`],
    });

    if (flats.length === 0) return { result };

    for (const flat of flats) {
      try {
        const address = await getAddressFromPhoton(flat.addressText);
        if (address) {
          console.log(
            `[task:address-improvement] ${flat.addressText} -> ${address.street} ${address.streetNumber} ${address.postalCode} ${address.city}`,
          );
          await db.transaction(async (tx) => {
            await tx.insert(addressTable).values(address).onConflictDoNothing();
            await tx
              .update(flatTable)
              .set({ addressId: address.id, addressImprovement: "success" })
              .where(eq(flatTable.id, flat.id));
          });
          result.stats.addressesImproved++;
        } else {
          console.error(
            `[task:address-improvement] No address found for ${flat.addressText}`,
          );

          await db
            .update(flatTable)
            .set({ addressImprovement: "failed" })
            .where(eq(flatTable.id, flat.id));
          result.stats.addressesFailed++;
        }
      } catch (e) {
        console.error(e);
        result.stats.addressesFailed++;
      }

      await Bun.sleep(2000 + Math.random() * 5000);
    }

    result.stats.addressesPending = await db
      .select({ count: count() })
      .from(flatTable)
      .where(
        and(
          isNull(flatTable.addressId),
          isNotNull(flatTable.addressText),
          eq(flatTable.addressImprovement, "pending"),
        ),
      )
      .execute()
      .then((res) => res[0]?.count ?? 0);

    console.log(
      `[task:address-improvement] improved ${result.stats.addressesImproved} addresses, failed ${result.stats.addressesFailed} addresses, pending ${result.stats.addressesPending} addresses`,
    );
    return { result };
  },
});
