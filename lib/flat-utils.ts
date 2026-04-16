import sharp from "sharp";
import { propertyManagements } from "~/data/propertyManagements";
import { deuwo } from "~/data/propertyManagements/deuwo";

/** Minimal fields for ignore rules (scraped flat + `propertyManagementId`, or DB row). */
export type FlatForIgnoreCheck = {
  title: string;
  propertyManagementId?: string | null;
  coldRentPrice?: number | null;
  warmRentPrice?: number | null;
};

function isDeutscheWohnenCheapListing(flat: FlatForIgnoreCheck): boolean {
  if (flat.propertyManagementId !== deuwo.slug) return false;
  const rent = flat.coldRentPrice ?? flat.warmRentPrice ?? null;
  return rent !== null && rent <= 100;
}

/**
 * Returns true if the listing should be ignored (not shown): parking-only-style titles,
 * or Deutsche Wohnen listings at ≤100€ (cold rent, else warm).
 * Parking in the title as an included amenity does not count.
 */
export function isParkingSpace(flat: FlatForIgnoreCheck): boolean {
  if (isDeutscheWohnenCheapListing(flat)) return true;
  return isIgnoredByTitle(flat.title);
}

function isIgnoredByTitle(title: string): boolean {
  const parkingKeywords = [
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

  const lowerTitle = title.toLowerCase();

  const includePatterns = [
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

  const hasIncludedParking = includePatterns.some((pattern) => {
    return parkingKeywords.some((keyword) => {
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
  });

  if (hasIncludedParking) {
    return false;
  }

  return parkingKeywords.some((keyword) => lowerTitle.includes(keyword));
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
