import { propertyManagementConfigs } from "~/data/propertyManagements/configs";

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

export function getFlatImageUrl(flat: { id: string; hasImage: boolean }) {
  if (!flat.hasImage) return null;
  const config = useRuntimeConfig();

  return flat.hasImage
    ? `${config.public.deploymentUrl}/api/image/${flat.id}`
    : `${config.public.deploymentUrl}/apartment_example_image.png`;
}
