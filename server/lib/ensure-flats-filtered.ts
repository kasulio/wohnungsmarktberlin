import { dedupeFlatsByUrl } from "~/server/lib/dedupe-flats-by-url";

let ensurePromise: Promise<void> | undefined;

/** Dedupe flats by URL once per process (after migrations). */
export function ensureFlatsFiltered(): Promise<void> {
  ensurePromise ??= (async () => {
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
