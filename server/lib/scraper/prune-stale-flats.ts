import { and, isNotNull, lte } from "drizzle-orm";
import { db } from "~/server/db/client";
import { flat } from "~/server/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Soft-delete flats not seen recently (global, all property managements).
 */
export async function pruneFlatsNotSeenForDays(days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * MS_PER_DAY);
  await db
    .update(flat)
    .set({ deleted: new Date() })
    .where(
      and(isNotNull(flat.lastSeen), lte(flat.lastSeen, cutoff)),
    );
}
