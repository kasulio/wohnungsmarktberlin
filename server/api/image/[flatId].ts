import { eq } from "drizzle-orm";
import { createLogger } from "~/lib/logger";
import { db } from "~/server/db/client";
import { flat } from "~/server/db/schema";

const log = createLogger("api:image");

export default defineEventHandler(async (e) => {
  const flatId = getRouterParam(e, "flatId");

  if (!flatId) {
    return null;
  }

  // get the image from the database
  const image = await db.query.flat
    .findFirst({
      where: eq(flat.id, flatId),
      columns: {
        image: true,
      },
    })
    .then((flat) => flat?.image);

  if (!image) {
    log.warn("image not found for flat", { flatId });
    throw createError({
      statusCode: 404,
      statusMessage: "Image not found",
    });
  }

  setResponseHeaders(e, {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": "image/jpeg",
  });

  return image;
});
