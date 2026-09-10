import { sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { dedupeFlatsByUrl } from "~/server/lib/dedupe-flats-by-url";

let ensurePromise: Promise<void> | undefined;

/** True once the initial migration has created the `flat` table. */
function flatTableExists(): boolean {
  const row = db.get<{ name: string } | undefined>(
    sql`select name from sqlite_master where type = 'table' and name = 'flat'`,
  );
  return row !== undefined && row !== null;
}

/** Dedupe flats by URL once per process (before migrations). */
export function ensureFlatsFiltered(): Promise<void> {
  ensurePromise ??= (async () => {
    if (!flatTableExists()) {
      console.log("[plugin:filter-flats] No flat table yet, skipping dedupe");
      return;
    }
    const removed = await dedupeFlatsByUrl();
    if (removed > 0) {
      console.log(
        `[plugin:filter-flats] Removed ${removed} duplicate flat rows`,
      );
    } else {
      console.log("[plugin:filter-flats] No duplicate flat URLs");
    }
  })();
  return ensurePromise;
}
