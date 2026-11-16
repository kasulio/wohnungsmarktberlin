import { and, isNotNull, lte } from "drizzle-orm";
import { Clock, Effect } from "effect";
import { flat } from "~/server/db/schema";
import { query } from "~/server/db/service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Soft-deletes flats of every company that no sync has seen for `days`. */
export const pruneStaleFlats = (days: number) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const cutoff = new Date(now - days * MS_PER_DAY);
    yield* query("prune stale flats", (db) =>
      db
        .update(flat)
        .set({ deleted: new Date(now) })
        .where(and(isNotNull(flat.lastSeen), lte(flat.lastSeen, cutoff))),
    );
  });
