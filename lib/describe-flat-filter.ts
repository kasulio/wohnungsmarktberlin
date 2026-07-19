import {
  UNKNOWN_DISTRICT_ID,
  berlinDistricts,
  unknownDistrict,
} from "~/data/districts";
import { type FlatFilter } from "~/lib/flat-filters";

function districtDisplayName(id: string): string {
  if (id === UNKNOWN_DISTRICT_ID) return unknownDistrict.name;
  return berlinDistricts[id as keyof typeof berlinDistricts]?.name ?? id;
}

/** Human-readable German summary of a filter (bot confirmations, admin UI). */
export function describeFlatFilter(
  filter: FlatFilter | null | undefined,
): string {
  if (!filter) return "alle neuen Inserate";
  const parts: string[] = [];
  if (filter.priceMin != null || filter.priceMax != null) {
    parts.push(
      `Warmmiete ${filter.priceMin ?? "0"}–${filter.priceMax ?? "∞"} €`,
    );
  }
  if (filter.roomsMin != null || filter.roomsMax != null) {
    parts.push(`${filter.roomsMin ?? "0"}–${filter.roomsMax ?? "∞"} Zimmer`);
  }
  if (filter.areaMin != null || filter.areaMax != null) {
    parts.push(`${filter.areaMin ?? "0"}–${filter.areaMax ?? "∞"} m²`);
  }
  if (filter.districts?.length) {
    parts.push(
      `Bezirke: ${filter.districts.map(districtDisplayName).join(", ")}`,
    );
  }
  if (filter.propertyManagements?.length) {
    parts.push(`Verwaltungen: ${filter.propertyManagements.join(", ")}`);
  }
  if (filter.tags?.length) parts.push(`Tags: ${filter.tags.join(", ")}`);
  if (filter.ids?.length) parts.push(`${filter.ids.length} feste ID(s)`);
  return parts.length ? parts.join(" · ") : "alle neuen Inserate";
}
