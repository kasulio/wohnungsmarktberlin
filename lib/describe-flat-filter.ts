import { type FlatFilter } from "~/lib/flat-filters";

/** Human-readable German summary of a filter (bot confirmations, admin UI). */
export function describeFlatFilter(
  filter: FlatFilter | null | undefined,
): string {
  if (!filter) return "alle neuen Inserate";
  const parts: string[] = [];
  if (filter.priceMin != null || filter.priceMax != null) {
    parts.push(`Preis ${filter.priceMin ?? "0"}–${filter.priceMax ?? "∞"} €`);
  }
  if (filter.roomsMin != null || filter.roomsMax != null) {
    parts.push(`${filter.roomsMin ?? "0"}–${filter.roomsMax ?? "∞"} Zi.`);
  }
  if (filter.areaMin != null || filter.areaMax != null) {
    parts.push(`${filter.areaMin ?? "0"}–${filter.areaMax ?? "∞"} m²`);
  }
  if (filter.districts?.length) {
    parts.push(`Bezirke: ${filter.districts.join(", ")}`);
  }
  if (filter.propertyManagements?.length) {
    parts.push(`Verwaltungen: ${filter.propertyManagements.join(", ")}`);
  }
  if (filter.tags?.length) parts.push(`Tags: ${filter.tags.join(", ")}`);
  if (filter.ids?.length) parts.push(`${filter.ids.length} feste ID(s)`);
  return parts.length ? parts.join(" · ") : "alle neuen Inserate";
}
