/**
 * Shared utility functions for property management scrapers
 */

/**
 * Parse German number format (e.g., "1.234,56 €") to a JavaScript number
 * Handles:
 * - Thousand separators (.) -> remove
 * - Decimal separators (,) -> convert to .
 * - Currency symbols and other non-numeric characters -> remove
 *
 * @param input - String containing German-formatted number
 * @returns Parsed number or null if input is invalid
 */
export function parseGermanNumberString(input?: string | null): number | null {
  if (!input) {
    return null;
  }

  // Remove currency symbols and whitespace
  let cleaned = input.replace(/[€\s]/g, "");

  // If both . and , are present, . is thousands separator, , is decimal
  if (cleaned.includes(".") && cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, ""); // Remove thousand separators
    cleaned = cleaned.replace(",", "."); // Convert decimal separator
  }
  // If only , is present, it's the decimal separator
  else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  // If only . is present and has more than 2 digits after it, it's likely thousands separator
  else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      // It's a decimal separator
    } else {
      // It's a thousands separator
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Clean and standardize address strings
 * Removes extra whitespace, newlines, and normalizes formatting
 *
 * @param address - Raw address string
 * @returns Cleaned address string
 */
export function cleanAddress(address?: string | null): string | null {
  if (!address) {
    return null;
  }

  return address
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, " ") // Replace newlines with space
    .replace(/\t+/g, " ") // Replace tabs with space
    .trim();
}

/**
 * Extract room count from various text formats
 * Handles: "3 Zimmer", "3-Zimmer", "3,5 Zimmer", etc.
 *
 * @param text - Text containing room count
 * @returns Room count as number or null
 */
export function extractRoomCount(text?: string | null): number | null {
  if (!text) {
    return null;
  }

  // Match patterns like "3 Zimmer", "3,5 Zimmer", "3.5 Zimmer"
  const match = text.match(/(\d+[,.]?\d*)\s*(?:Zimmer|zimmer|Zi\.)/);
  if (match) {
    return parseGermanNumberString(match[1]);
  }

  return null;
}

/**
 * Extract area (square meters) from text
 * Handles: "47,99 m²", "47.99 m2", "47,99m²", etc.
 *
 * @param text - Text containing area
 * @returns Area as number or null
 */
export function extractArea(text?: string | null): number | null {
  if (!text) {
    return null;
  }

  // Match patterns like "47,99 m²", "47.99 m2"
  const match = text.match(/(\d+[,.]?\d*)\s*(?:m²|m2|qm)/i);
  if (match) {
    return parseGermanNumberString(match[1]);
  }

  return null;
}
