import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getAddressFromPhoton } from "~/lib/photon";
import { db } from "~/server/db/client";
import { address as addressTable, flat as flatTable } from "~/server/db/schema";
import { runNotifySweep } from "~/server/lib/notify-sweep";

export type AddressImprovementStats = {
  addressesImproved: number;
  addressesFailed: number;
  addressesPending: number;
};

export type RunAddressImprovementOptions = {
  /** Max pending flats to process this run. */
  limit?: number;
  /** Kick notify sweep when any address became resolved. Default true. */
  notify?: boolean;
};

/** In-process coalesce so cron + post-insert kicks don't double-hit Photon. */
let inFlight: Promise<AddressImprovementStats> | null = null;

/**
 * Resolve pending flat addresses via Photon, then optionally notify
 * subscribers of newly-publishable flats.
 */
export async function runAddressImprovement(
  options: RunAddressImprovementOptions = {},
): Promise<AddressImprovementStats> {
  if (inFlight) return inFlight;

  inFlight = improveAddresses(options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function improveAddresses(
  options: RunAddressImprovementOptions,
): Promise<AddressImprovementStats> {
  const limit = options.limit ?? 10;
  const shouldNotify = options.notify ?? true;
  const stats: AddressImprovementStats = {
    addressesImproved: 0,
    addressesFailed: 0,
    addressesPending: 0,
  };

  const flats = await db.query.flat.findMany({
    where: and(
      isNull(flatTable.addressId),
      isNotNull(flatTable.addressText),
      eq(flatTable.addressImprovement, "pending"),
      eq(flatTable.ignored, false),
    ),
    limit,
    orderBy: [sql`random()`],
  });

  if (flats.length === 0) {
    stats.addressesPending = 0;
    return stats;
  }

  for (const flat of flats) {
    try {
      const address = await getAddressFromPhoton(flat.addressText);
      if (address) {
        console.log(
          `[address-improvement] ${flat.addressText} -> ${address.street} ${address.streetNumber} ${address.postalCode} ${address.city}`,
        );
        await db.transaction(async (tx) => {
          await tx.insert(addressTable).values(address).onConflictDoNothing();
          await tx
            .update(flatTable)
            .set({ addressId: address.id, addressImprovement: "success" })
            .where(eq(flatTable.id, flat.id));
        });
        stats.addressesImproved++;
      } else {
        console.error(
          `[address-improvement] No address found for ${flat.addressText}`,
        );
        await db
          .update(flatTable)
          .set({ addressImprovement: "failed" })
          .where(eq(flatTable.id, flat.id));
        stats.addressesFailed++;
      }
    } catch (e) {
      console.error(e);
      stats.addressesFailed++;
    }

    await Bun.sleep(2000 + Math.random() * 5000);
  }

  stats.addressesPending = await db
    .select({ count: count() })
    .from(flatTable)
    .where(
      and(
        isNull(flatTable.addressId),
        isNotNull(flatTable.addressText),
        eq(flatTable.addressImprovement, "pending"),
        eq(flatTable.ignored, false),
      ),
    )
    .execute()
    .then((res) => res[0]?.count ?? 0);

  console.log(
    `[address-improvement] improved ${stats.addressesImproved}, failed ${stats.addressesFailed}, pending ${stats.addressesPending}`,
  );

  if (shouldNotify && stats.addressesImproved > 0) {
    try {
      await runNotifySweep();
    } catch (e) {
      // Addresses already saved; cron notify recovers. Don't fail this run.
      console.error("[address-improvement] notify sweep failed:", e);
    }
  }

  return stats;
}
