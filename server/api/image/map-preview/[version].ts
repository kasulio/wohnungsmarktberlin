import {
  mapPreviewImagePath,
  updateMapPreview,
} from "~/server/updateMapPreview";

if (!(await Bun.file(mapPreviewImagePath).exists())) {
  await updateMapPreview();
}

// The version segment is only a cache-buster; it must live in the path
// (not a query string) because the IPX cache key strips query strings,
// which made image data and metadata collide under the same cache key.
export default defineEventHandler(async (e) => {
  const content = Bun.file(mapPreviewImagePath);
  setResponseHeaders(e, {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": "image/png",
  });
  return content.stream();
});
