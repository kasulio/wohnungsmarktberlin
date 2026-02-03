import { promises as fs, constants } from "fs";
import { simpleImageCache } from "~/server/image-cache";
import {
  mapPreviewImagePath,
  updateMapPreview,
} from "~/server/updateMapPreview";

// make sure the map preview image exists
// this will probably make the devserver fail, just start it again
try {
  await fs.access(mapPreviewImagePath, constants.F_OK);
} catch (error) {
  updateMapPreview("");
}
export const mapPreviewCache = simpleImageCache("map-preview", () =>
  fs.readFile(mapPreviewImagePath),
);

export default defineEventHandler(async (e) => {
  const query = getQuery(e);

  const { format, content } = await mapPreviewCache(query);
  setResponseHeaders(e, {
    "Cache-Control": "public, max-age=14400, s-maxage=14400",
    "Content-Type": `image/${format}`,
  });
  return content;
});
