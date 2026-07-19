import { gte, inArray, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { address, flat } from "~/server/db/schema";
import {
  UNKNOWN_DISTRICT_ID,
  allBerlinZipCodes,
  berlinDistricts,
  districtIdSchema,
  isMappedPostalCode,
} from "~/data/districts";
import { propertyManagementIdSchema } from "~/data/propertyManagements/configs";
import {
  getApartmentTags,
  tagsSchema,
  titleMatchesAnyTagFilter,
} from "~/data/tags";

/** A flat is considered "new" for this many seconds after `firstSeen`. */
export const countsAsNewTime = 60 * 60 * 12;

/** SQL predicate: the flat's `firstSeen` is within the "new" window. */
export const isFlatNew = sql`strftime('%s', 'now') - ${flat.firstSeen} < ${countsAsNewTime}`;

/** TS equivalent of {@link isFlatNew}. */
export function flatIsNew(firstSeen: Date, now: Date = new Date()): boolean {
  return (now.getTime() - firstSeen.getTime()) / 1000 < countsAsNewTime;
}

/**
 * A single, normalized (un-arrayed) filter definition shared by the tRPC
 * router (SQL) and the Telegram bot (in-memory). The URL schema in
 * `useUrlState` is a thin array-wrapped adapter over these same fields.
 */
export const flatFilterSchema = z.object({
  ids: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  propertyManagements: z.array(propertyManagementIdSchema).optional(),
  districts: z.array(z.string()).optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  roomsMin: z.number().optional(),
  roomsMax: z.number().optional(),
  areaMin: z.number().optional(),
  areaMax: z.number().optional(),
});

export type FlatFilter = z.infer<typeof flatFilterSchema>;

/** Resolve real district ids to the union of their zip codes (skips "unbekannt"). */
function districtsToZipCodes(districts: string[]): string[] {
  return districts
    .map((inputDistrict) => {
      if (inputDistrict === UNKNOWN_DISTRICT_ID) return [];
      const res = districtIdSchema.safeParse(inputDistrict);
      if (!res.success) return [];
      return berlinDistricts[res.data].zipCodes;
    })
    .flat();
}

/**
 * District filter: real Bezirke → PLZ IN …; virtual "unbekannt" → PLZ not
 * mapped to any Bezirk. Combined with OR when both are selected.
 */
function districtFilterSql(districts: string[]): SQL | undefined {
  const wantsUnknown = districts.includes(UNKNOWN_DISTRICT_ID);
  const zipCodes = districtsToZipCodes(districts);
  const knownMatch =
    zipCodes.length > 0 ? inArray(address.postalCode, zipCodes) : undefined;
  const unknownMatch = wantsUnknown
    ? notInArray(address.postalCode, allBerlinZipCodes)
    : undefined;

  if (knownMatch && unknownMatch) return or(knownMatch, unknownMatch);
  return knownMatch ?? unknownMatch;
}

function matchesDistrictFilter(
  postalCode: string | null,
  districts: string[],
): boolean {
  const wantsUnknown = districts.includes(UNKNOWN_DISTRICT_ID);
  const zipCodes = new Set(districtsToZipCodes(districts));
  const matchesKnown =
    postalCode != null && zipCodes.size > 0 && zipCodes.has(postalCode);
  const matchesUnknown =
    wantsUnknown && (postalCode == null || !isMappedPostalCode(postalCode));
  return matchesKnown || matchesUnknown;
}

/** The subset of `tags` that are title-derived (i.e. not the "new" pseudo-tag). */
function titleTagsFor(tags: string[] | undefined): string[] {
  const withoutNew = tags?.filter((t) => t !== "new") ?? [];
  const parsed = tagsSchema.safeParse(withoutNew);
  return parsed.success ? parsed.data : [];
}

/**
 * Build the WHERE conditions for a {@link FlatFilter}. Does NOT include the
 * publishability predicate — callers combine it with
 * `publishableFlatFilter()`. Preserves the exact semantics of the previous
 * inline filter array in `flat.ts` (price OR cold/warm, districts→zipCodes,
 * title-tag match, null-guarded rooms/area).
 */
export function flatFilterToSql(filter: FlatFilter): SQL[] {
  const titleTags = titleTagsFor(filter.tags);
  const conditions: (SQL | undefined)[] = [
    filter.ids &&
      (filter.ids.length ? inArray(flat.id, filter.ids) : sql`FALSE`),
    filter.propertyManagements &&
      inArray(flat.propertyManagementId, filter.propertyManagements),
    filter.districts ? districtFilterSql(filter.districts) : undefined,
    filter.tags?.includes("new") ? isFlatNew : undefined,
    titleTags.length > 0
      ? titleMatchesAnyTagFilter(flat.title, tagsSchema.parse(titleTags))
      : undefined,
    filter.priceMin != null
      ? gte(
          sql`COALESCE(${flat.warmRentPrice}, ${flat.coldRentPrice})`,
          filter.priceMin,
        )
      : undefined,
    filter.priceMax != null
      ? lte(
          sql`COALESCE(${flat.warmRentPrice}, ${flat.coldRentPrice})`,
          filter.priceMax,
        )
      : undefined,
    filter.roomsMin != null ? gte(flat.roomCount, filter.roomsMin) : undefined,
    filter.roomsMax != null ? lte(flat.roomCount, filter.roomsMax) : undefined,
    filter.areaMin != null ? gte(flat.usableArea, filter.areaMin) : undefined,
    filter.areaMax != null ? lte(flat.usableArea, filter.areaMax) : undefined,
  ];

  return conditions.filter((c): c is SQL => Boolean(c));
}

/** The minimal flat shape {@link matchesFilter} needs to evaluate a filter. */
export type FilterableFlat = {
  id: string;
  title: string;
  propertyManagementId: string | null;
  coldRentPrice: number | null;
  warmRentPrice: number | null;
  roomCount: number | null;
  usableArea: number | null;
  firstSeen: Date;
  postalCode: string | null;
};

/**
 * In-memory equivalent of {@link flatFilterToSql}, evaluating the same filter
 * against a single flat. The two derive from the same field-by-field rules so
 * they cannot drift.
 */
export function matchesFilter(
  flat: FilterableFlat,
  filter: FlatFilter,
  now: Date = new Date(),
): boolean {
  if (filter.ids && !filter.ids.includes(flat.id)) return false;

  if (
    filter.propertyManagements &&
    (flat.propertyManagementId == null ||
      !filter.propertyManagements.includes(flat.propertyManagementId as never))
  ) {
    return false;
  }

  if (
    filter.districts &&
    !matchesDistrictFilter(flat.postalCode, filter.districts)
  ) {
    return false;
  }

  if (filter.tags?.includes("new") && !flatIsNew(flat.firstSeen, now)) {
    return false;
  }

  const titleTags = titleTagsFor(filter.tags);
  if (titleTags.length > 0) {
    const flatTags = new Set(getApartmentTags(flat.title));
    if (!titleTags.some((t) => flatTags.has(t as never))) return false;
  }

  const rent = effectiveRent(flat);
  if (filter.priceMin != null && !gtePrice(rent, filter.priceMin)) {
    return false;
  }
  if (filter.priceMax != null && !ltePrice(rent, filter.priceMax)) {
    return false;
  }

  if (
    filter.roomsMin != null &&
    !(flat.roomCount != null && flat.roomCount >= filter.roomsMin)
  ) {
    return false;
  }
  if (
    filter.roomsMax != null &&
    !(flat.roomCount != null && flat.roomCount <= filter.roomsMax)
  ) {
    return false;
  }
  if (
    filter.areaMin != null &&
    !(flat.usableArea != null && flat.usableArea >= filter.areaMin)
  ) {
    return false;
  }
  if (
    filter.areaMax != null &&
    !(flat.usableArea != null && flat.usableArea <= filter.areaMax)
  ) {
    return false;
  }

  return true;
}

/** Warmmiete when present, otherwise Kaltmiete — matches SQL COALESCE. */
function effectiveRent(flat: FilterableFlat): number | null {
  return flat.warmRentPrice ?? flat.coldRentPrice ?? null;
}

/** null-safe `>=`, matching SQL where `NULL >= x` is not true. */
function gtePrice(value: number | null, bound: number): boolean {
  return value != null && value >= bound;
}

/** null-safe `<=`, matching SQL where `NULL <= x` is not true. */
function ltePrice(value: number | null, bound: number): boolean {
  return value != null && value <= bound;
}
