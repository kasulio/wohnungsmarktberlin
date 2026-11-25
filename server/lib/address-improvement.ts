import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { createLogger } from "~/lib/logger";
import { getAddressFromPhoton } from "~/lib/photon";
import { db } from "~/server/db/client";
import { address as addressTable, flat as flatTable } from "~/server/db/schema";
import { runNotifySweep } from "~/server/lib/notify-sweep";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import { createCoalescedRunner } from "~/server/lib/single-flight";

const log = createLogger("address-improvement");

export type AddressImprovementStats = {
  addressesImproved: number;
  /** Permanently marked failed because Photon returned no usable address match. */
  addressesFailed: number;
  /** Transient Photon/network failures; flat remains pending for a later retry. */
  addressesTransientFailed: number;
  addressesPending: number;
};

export type RunAddressImprovementOptions = {
  /** Max pending flats to process this run. */
  limit?: number;
  /** Kick notify sweep when any address became resolved. Default true. */
  notify?: boolean;
};

const runCoalesced = createCoalescedRunner(
  (options: RunAddressImprovementOptions) => improveAddresses(options),
);

/**
 * Resolve pending flat addresses via Photon, then optionally notify
 * subscribers of newly-publishable flats. Coalesces concurrent callers so
 * cron + post-extract kicks don't double-hit Photon.
 */
export function runAddressImprovement(
  options: RunAddressImprovementOptions = {},
): Promise<AddressImprovementStats> {
  return runCoalesced(options);
}

async function improveAddresses(
  options: RunAddressImprovementOptions,
): Promise<AddressImprovementStats> {
  const limit = options.limit ?? 10;
  const shouldNotify = options.notify ?? true;
  const stats: AddressImprovementStats = {
    addressesImproved: 0,
    addressesFailed: 0,
    addressesTransientFailed: 0,
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

  let lastTransientError: string | null = null;

  for (const flat of flats) {
    try {
      const address = await getAddressFromPhoton(flat.addressText);
      if (address) {
        log.debug("geocoded flat address", {
          flatId: flat.id,
          addressText: flat.addressText,
          resolved: `${address.street} ${address.streetNumber}, ${address.postalCode} ${address.city}`,
        });
        await db.transaction(async (tx) => {
          await tx.insert(addressTable).values(address).onConflictDoNothing();
          await tx
            .update(flatTable)
            .set({ addressId: address.id, addressImprovement: "success" })
            .where(eq(flatTable.id, flat.id));
        });
        stats.addressesImproved++;
      } else {
        log.warn("no photon address match", {
          flatId: flat.id,
          pm: flat.propertyManagementId,
          addressText: flat.addressText,
        });
        await db
          .update(flatTable)
          .set({ addressImprovement: "failed" })
          .where(eq(flatTable.id, flat.id));
        stats.addressesFailed++;
      }
    } catch (error) {
      // Transient HTTP/network/DB error: keep `addressImprovement = "pending"`
      // so the next tick retries instead of permanently hiding the flat.
      lastTransientError =
        error instanceof Error ? error.message : String(error);
      log.warn("transient geocoding failure, keeping flat pending", {
        flatId: flat.id,
        addressText: flat.addressText,
        error,
      });
      stats.addressesTransientFailed++;
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

  log.info("address improvement batch completed", stats);

  if (stats.addressesTransientFailed >= 3) {
    void sendOpsAlert({
      key: "photon-transient-errors",
      title: `Photon geocoding hit ${stats.addressesTransientFailed} transient error(s) in one batch`,
      details: `${lastTransientError ?? "unknown error"} (pending: ${stats.addressesPending})`,
    });
  }

  if (shouldNotify && stats.addressesImproved > 0) {
    try {
      await runNotifySweep();
    } catch (error) {
      // Addresses already saved; cron notify recovers. Don't fail this run.
      log.error("post-geocode notify sweep failed", { error });
    }
  }

  return stats;
}
