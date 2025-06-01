import { db } from "~/db/db";
import { simpleImageCache } from "~/server/image-cache";

const imagesCache = new Map<string, ReturnType<typeof simpleImageCache>>();

export default defineEventHandler(async (e) => {
  const flatId = getRouterParam(e, "flatId");

  if (!flatId) {
    return null;
  }

  // check if imagesCache has the flatId
  if (!imagesCache.has(flatId)) {
    imagesCache.set(
      flatId,
      simpleImageCache(
        `flat-${flatId}`,
        () => {
          return db.query.flat
            .findFirst({
              where: (f, { eq }) => eq(f.id, flatId),
              columns: { image: true },
            })
            .then((res) => res!.image!);
        },
        2,
      ),
    );

    // make sure imageCache does not get too big
    if (imagesCache.size > 100) {
      imagesCache.delete(imagesCache.keys().next().value);
    }
  }

  const cache = imagesCache.get(flatId)!;
  const query = getQuery(e);
  const { format, content } = await cache({
    w: 64,
    h: 64,
    ...query,
  });
  setResponseHeaders(e, {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": `image/${format}`,
  });

  return content;
});
