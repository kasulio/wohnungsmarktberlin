import { propertyManagementConfigs } from "~/data/propertyManagements/configs";
import type {
  ListingFlat,
  ListingFlatImage,
  ListingFlatWithCoordinates,
} from "~/types/listing-flat";

export function getProviderName(
  propertyManagementId: string | null | undefined,
): string | null {
  if (!propertyManagementId) return null;
  const pm =
    propertyManagementConfigs[
      propertyManagementId as keyof typeof propertyManagementConfigs
    ] ?? null;
  return pm?.name ?? null;
}

export function hasMapCoordinates(
  flat: ListingFlat,
): flat is ListingFlatWithCoordinates {
  const { latitude, longitude } = flat.address;
  return latitude != null && longitude != null;
}

export function getFlatImageUrl(flat: ListingFlatImage, deploymentUrl: string) {
  if (!flat.hasImage) return null;
  return `${deploymentUrl}/api/image/${flat.id}`;
}
