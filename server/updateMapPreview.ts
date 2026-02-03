import path from "path";
import { and, isNotNull, isNull } from "drizzle-orm";
import { mapPreviewCache } from "./api/image/map-preview";
import { db } from "~/db/db";
import { flat } from "~/db/schema";
import { env } from "~/env";
import { berlinCoordinates } from "~/data/coordinates";

export const mapPreviewImagePath = path.join(
  process.cwd(),
  "public",
  "map-preview.png",
);

export async function updateMapPreview(previewHash: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", "52.520008,13.404954");
  url.searchParams.set("zoom", "11");
  url.searchParams.set("size", "640x640");
  url.searchParams.set("scale", "2");
  url.searchParams.set("map_id", env.NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID);
  url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);

  // get location of all flats
  const flats = await db.query.flat.findMany({
    with: {
      address: true,
    },
    where: and(isNull(flat.deleted), isNotNull(flat.addressId)),
  });

  const markers = flats
    .map((f) => `${f.address!.latitude},${f.address!.longitude}`)
    .join("|");

  const markerFileUrl = `https://wohnungsmarktberlin.de/marker.png?v=1.0`;

  url.searchParams.set("markers", `icon:${markerFileUrl}|${markers}`);
  // load image and save it to disk
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  const image = Buffer.from(buffer);

  await Bun.file(mapPreviewImagePath).write(image);

  mapPreviewCache({ v: previewHash, w: 512, h: 512 });
  mapPreviewCache({ v: previewHash, w: 1024, h: 1024 });

  return true;
}
