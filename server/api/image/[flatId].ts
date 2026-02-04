import { eq } from "drizzle-orm";
import { db } from "~/db/db";
import { flat } from "~/db/schema";

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
    console.error(`[api:image] image not found for flat ${flatId}`);
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
