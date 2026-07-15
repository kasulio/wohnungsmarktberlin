import sharp from "sharp";
import { propertyManagements } from "~/data/propertyManagements";
import { type FlatForIgnoreCheck } from "~/data/schemas";

export type { FlatForIgnoreCheck };
const COMMERCIAL_TITLE_KEYWORDS = [
  "gewerbe",
  "gewerbefläche",
  "gewerbeflaeche",
  "gewerbemietfläche",
  "gewerbemietflaeche",
  "gewerbeeinheit",
  "büro",
  "buero",
  "praxis",
  "praxisräume",
  "praxisraeume",
  "ladengeschäft",
  "ladengeschaeft",
  "kiezladen",
  "einzelhandel",
  "einzelhandelsfläche",
  "einzelhandelsflaeche",
  "geschäft",
  "geschaeft",
  "dienstleistung",
  "yoga-studio",
  "gesundheitsstandort",
  "lagerfläche",
  "lagerflaeche",
  "werkstatt",
  "einzelhandels-",
  "gastronomie",
  "restaurant",
  "pizzeria",
];

export function isCommercialByTitle(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return COMMERCIAL_TITLE_KEYWORDS.some((keyword) =>
    lowerTitle.includes(keyword),
  );
}

const PARKING_TITLE_KEYWORDS = [
  "parkplatz",
  "stellplatz",
  "garage",
  "tiefgarage",
  "außenstellplatz",
  "duplex-parker",
  "duplexparker",
  "pkw-stellplatz",
  "pkw stellplatz",
  "kfz-stellplatz",
  "kfz stellplatz",
  "stressfrei parken",
  "parken",
  "parkplatzsuche",
  "auto stehen",
  "ihr auto",
];

const PARKING_INCLUDED_IN_AMENITY_PATTERNS = [
  "inklusive",
  "inkl.",
  "inkl ",
  "mit ",
  "incl.",
  "incl ",
  "wohnung mit",
  "zimmer mit",
  "+ ",
  "& ",
];

export function isParkingByTitle(title: string): boolean {
  const lowerTitle = title.toLowerCase();

  const hasIncludedParking = PARKING_INCLUDED_IN_AMENITY_PATTERNS.some(
    (pattern) => {
      return PARKING_TITLE_KEYWORDS.some((keyword) => {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex =
          pattern === "mit "
            ? new RegExp(
                `\\bmit\\s+(?!uns\\b|ihnen\\b|dir\\b|euch\\b|ihm\\b|ihr\\b).*${escapedKeyword}`,
                "i",
              )
            : new RegExp(
                `${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*${escapedKeyword}`,
                "i",
              );
        return regex.test(lowerTitle);
      });
    },
  );

  if (hasIncludedParking) {
    return false;
  }

  return PARKING_TITLE_KEYWORDS.some((keyword) => lowerTitle.includes(keyword));
}

/**
 * Returns true if the listing should be ignored (not shown): provider-specific
 * rules, then non-residential commercial/parking title keywords.
 */
export function shouldIgnoreListing(flat: FlatForIgnoreCheck): boolean {
  const { propertyManagementId } = flat;
  if (
    propertyManagementId != null &&
    propertyManagementId in propertyManagements
  ) {
    const pm = propertyManagements[propertyManagementId];
    if ("shouldIgnoreListing" in pm && pm.shouldIgnoreListing?.(flat))
      return true;
  }
  if (isParkingByTitle(flat.title)) return true;
  if (isCommercialByTitle(flat.title)) return true;
  return false;
}

/**
 * Gets a property management configuration by ID.
 * Throws an error if the property management is not found.
 */
export function getPropertyManagement(propertyManagementId: string) {
  const propertyManagement =
    propertyManagements[
      propertyManagementId as keyof typeof propertyManagements
    ];
  if (!propertyManagement) {
    throw new Error(`Property management not found: ${propertyManagementId}`);
  }
  return propertyManagement;
}

/**
 * Fetches and processes an image from a remote URL.
 * Resizes the image to 200x200 pixels.
 * Returns null if the image cannot be processed.
 */
export async function getImage(remoteImageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(remoteImageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const processedBuffer = await sharp(buffer)
      .resize(200, 200, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    return processedBuffer;
  } catch (e) {
    console.error(e);
    return null;
  }
}
