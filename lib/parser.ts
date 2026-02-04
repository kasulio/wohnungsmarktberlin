export function parseNumberString(input: string | undefined): number | undefined {
  if (!input) return undefined;

  // Remove whitespace
  input = input.trim();

  // Detect whether comma or period is the decimal separator
  // If there's both, the last one is the decimal separator
  const lastComma = input.lastIndexOf(",");
  const lastPeriod = input.lastIndexOf(".");

  let normalized = input;
  if (lastComma > lastPeriod) {
    // Comma is the decimal separator (German format)
    // Remove all periods and replace comma with period
    normalized = input.replace(/\./g, "").replace(",", ".");
  } else if (lastPeriod > lastComma) {
    // Period is the decimal separator (English format or already normalized)
    // Just remove commas (if any thousands separators)
    normalized = input.replace(/,/g, "");
  }

  const res = parseFloat(normalized);
  return isNaN(res) ? undefined : res;
}

export function parseNumberStringToInt(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const res = parseInt(input.replace(/\./g, "").replace(",", "."));
  return isNaN(res) ? undefined : res;
}

/**
 * Cleans and formats an address string
 *
 * @example
 * cleanAddress("  Musterstr. 123  ", "10115", "Berlin")
 * // "Musterstr. 123, 10115 Berlin"
 */
export function cleanAddress(street: string, postalCode?: string, city?: string): string {
  const parts = [street.trim()];

  if (postalCode && city) {
    parts.push(`${postalCode} ${city}`);
  } else if (postalCode) {
    parts.push(postalCode);
  } else if (city) {
    parts.push(city);
  }

  return parts.join(", ");
}

/**
 * Extracts neighborhood from a location string
 * Handles various Berlin district formats
 *
 * @example
 * extractNeighborhood("Berlin-Mitte") // "Mitte"
 * extractNeighborhood("Mitte (Berlin)") // "Mitte"
 */
export function extractNeighborhood(location: string): string {
  if (!location) return "";

  // Remove "Berlin-" prefix
  let neighborhood = location.replace(/^Berlin-/i, "");

  // Remove parentheses and content
  neighborhood = neighborhood.replace(/\s*\([^)]*\)/g, "");

  return neighborhood.trim();
}

/**
 * Removes unwanted characters and normalizes whitespace
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, " ") // Replace newlines with space
    .trim();
}

/**
 * Safely extracts a number from text
 * Returns undefined if no valid number found
 */
export function extractNumber(text: string): number | undefined {
  const match = text.match(/[\d.,]+/);
  if (!match) return undefined;

  const num = parseNumberString(match[0]);
  return num && num > 0 ? num : undefined;
}

/**
 * Checks if a string contains any of the given patterns
 */
export function containsAny(text: string, patterns: string[]): boolean {
  const lowerText = text.toLowerCase();
  return patterns.some((pattern) => lowerText.includes(pattern.toLowerCase()));
}
