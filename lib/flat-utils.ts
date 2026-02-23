import sharp from "sharp";
import { propertyManagements } from "~/data/propertyManagements";

/**
 * Checks if a title represents a parking space listing.
 * Returns false if parking is mentioned as an included amenity rather than the main listing.
 */
export function isParkingSpace(title: string): boolean {
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

  // If parking is mentioned as an included feature (not the main listing), it's not a parking space
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

  // Check if any parking keyword appears after an include pattern (e.g. "inkl. Parkplatz")
  const hasIncludedParking = includePatterns.some((pattern) => {
    return parkingKeywords.some((keyword) => {
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`${escapedPattern}.*${escapedKeyword}`, "i");
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
