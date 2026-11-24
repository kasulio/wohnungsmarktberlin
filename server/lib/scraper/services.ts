import { Context, Data, Effect } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { type PropertyManagement } from "~/data/schemas";

/** The per-company scraper modules, by slug. */
export class Scrapers extends Context.Service<
  Scrapers,
  Partial<Record<PropertyManagementId, PropertyManagement>>
>()("Scrapers") {}

export class UnknownScraperError extends Data.TaggedError(
  "UnknownScraperError",
)<{
  propertyManagementId: string;
  message: string;
}> {}

export const scraperFor = (propertyManagementId: PropertyManagementId) =>
  Effect.gen(function* () {
    const scraper = (yield* Scrapers)[propertyManagementId];
    if (!scraper) {
      return yield* new UnknownScraperError({
        propertyManagementId,
        message: `No scraper configured for ${propertyManagementId}`,
      });
    }
    return scraper;
  });

/** Geocodes new flats (and notifies); kicked after a run that extracted something. */
export class AddressImprovement extends Context.Service<
  AddressImprovement,
  { run: () => Promise<unknown> }
>()("AddressImprovement") {}

/**
 * Extra pause between two jobs of one company on top of the Http host gap.
 * Background runs (cron) look like a slow visitor; interactive runs (admin)
 * rely on the host gap alone.
 */
export const ExtractPacing = Context.Reference<{
  background: { minMillis: number; maxMillis: number };
}>("ExtractPacing", {
  defaultValue: () => ({ background: { minMillis: 1000, maxMillis: 6000 } }),
});
