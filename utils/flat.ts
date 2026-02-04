export function getFlatImageUrl(flat: { id: string; hasImage: boolean }) {
  if (!flat.hasImage) return null;
  const config = useRuntimeConfig();

  return flat.hasImage
    ? `${config.public.deploymentUrl}/api/image/${flat.id}`
    : `${config.public.deploymentUrl}/apartment_example_image.png`;
}
