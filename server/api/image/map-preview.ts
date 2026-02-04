import {
  mapPreviewImagePath,
  updateMapPreview,
} from "~/server/updateMapPreview";

if (!(await Bun.file(mapPreviewImagePath).exists())) {
  await updateMapPreview();
}

export default defineEventHandler(async (e) => {
  const content = Bun.file(mapPreviewImagePath);
  setResponseHeaders(e, {
    "Cache-Control": "public, max-age=14400, s-maxage=14400",
    "Content-Type": "image/png",
  });
  return content.stream();
});
