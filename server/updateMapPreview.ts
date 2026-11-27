import path from "path";
import { and, isNotNull, isNull } from "drizzle-orm";
import { createLogger } from "~/lib/logger";
import { db } from "~/server/db/client";
import { flat } from "~/server/db/schema";
import { env } from "~/env";

const log = createLogger("map-preview");

export const mapPreviewImagePath = path.join(
  process.cwd(),
  "public",
  "map-preview.png",
);

export async function updateMapPreview() {
  log.info("updating map preview");
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

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(
      `Google Static Maps returned HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Google Static Maps returned unexpected content-type "${contentType}"`,
    );
  }

  const buffer = await response.arrayBuffer();
  const image = Buffer.from(buffer);

  await Bun.file(mapPreviewImagePath).write(image);
  log.info("map preview updated", {
    markers: flats.length,
    bytes: image.byteLength,
  });

  return true;
}
