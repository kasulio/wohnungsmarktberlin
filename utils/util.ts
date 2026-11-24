export function cleanNumberString(input?: string) {
  if (!input) {
    return "";
  }

  // Remove any characters that are not digits, comma, or dot
  let cleanedString = input.replace(/[^0-9,.]/g, "");
  if (cleanedString.includes(",") && cleanedString.includes(".")) {
    cleanedString = cleanedString.replace(".", "");
  }
  cleanedString = cleanedString.replace(",", ".");
  return cleanedString;
}

export function parseUncleanInt(input: string) {
  if (!input) {
    return null;
  }
  return parseInt(cleanNumberString(input));
}

export function parseUncleanFloat(input: string) {
  if (!input) {
    return null;
  }
  return parseFloat(cleanNumberString(input));
}

const NBSP = "\u00A0";

export function formatArea(input: number | null) {
  if (!input) {
    return "-";
  }
  return (input.toFixed(1) + `${NBSP}m²`).replace(".", ",");
}

export function formatPrice(input: number | null, rounded = false) {
  if (!input) {
    return "-";
  }
  const val = rounded ? Math.round(input) : input.toFixed(2);
  return (val + `${NBSP}€`).replace(".", ",");
}

export type RentPrices = {
  warmRentPrice?: number | null;
  coldRentPrice?: number | null;
};

/** Prefer warm rent, fall back to cold (map, favorites, primary display). */
export function primaryRentPrice(prices: RentPrices): number | null {
  return prices.warmRentPrice ?? prices.coldRentPrice ?? null;
}

export function formatPrimaryRent(prices: RentPrices, rounded = false): string {
  return formatPrice(primaryRentPrice(prices), rounded);
}

/** Treat 0 as unknown (scrapers / non-residential). */
export function formatRoomCount(roomCount: number | null | undefined): string {
  if (roomCount == null || roomCount === 0) {
    return "–";
  }
  return String(roomCount);
}

/** "gerade eben", "vor 5 Min.", "vor 3 Std.", "vor 4 Tagen"; "—" when unknown. */
export function formatAgo(d: Date | string | number | null | undefined) {
  if (d == null) return "—";
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return "—";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 48) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}
