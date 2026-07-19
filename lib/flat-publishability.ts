import { and, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { flat } from "~/server/db/schema";

/**
 * The minimal shape needed to decide whether a flat is publicly visible.
 * Any row selected from `flat` satisfies this.
 */
export type PublishableFlat = {
  deleted: Date | null;
  addressId: string | null;
  ignored: boolean;
};

/**
 * Single source of truth for public visibility of a flat: it must not be
 * soft-deleted, must have a resolved address, and must not be provider-ignored.
 *
 * Used by the `flat` tRPC router, the map-preview hash, and the Telegram sweep
 * so they cannot drift apart.
 */
export function isPublishable(f: PublishableFlat): boolean {
  return f.deleted == null && f.addressId != null && !f.ignored;
}

/** The SQL equivalent of {@link isPublishable}, for use in `where` clauses. */
export function publishableFlatFilter(): SQL {
  return and(
    isNull(flat.deleted),
    isNotNull(flat.addressId),
    eq(flat.ignored, false),
  )!;
}
