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
