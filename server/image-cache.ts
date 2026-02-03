import sharp from "sharp";
import { type QueryObject } from "ufo";
import { z } from "zod";
import { typedObjectKeys } from "~/utils/typeHelper";

const formatSchema = z.enum(["png", "webp", "avif"]);
const sizeSchema = z.object({
  w: z.coerce.number().int().positive(),
  h: z.coerce.number().int().positive(),
});

export type CacheContent = {
  png: Buffer;
  webp: Buffer;
  avif: Buffer;
};

const caches = new Map<
  string,
  {
    version: string;
    sizes: Record<`${number}x${number}`, CacheContent>;
    content: CacheContent | null;
    lastUsed: number;
  }
>();

const olderThan = 1000 * 60 * 60 * 2;
export function cleanUpCaches() {
  const now = Date.now();
  caches.forEach((cache, id) => {
    if (now - cache.lastUsed > olderThan) {
      caches.delete(id);
      console.log(`Deleted cache for ${id}, last used ${cache.lastUsed}`);
    }
  });
}

export function simpleImageCache(
  id: string,
  bufferGetter: () => Promise<Buffer>,
  maxCachedSizes = 4,
) {
  if (!caches.has(id)) {
    caches.set(id, {
      version: "0",
      sizes: {},
      content: null,
      lastUsed: Date.now(),
    });
  }

  const cache = caches.get(id)!;

  return async (query: QueryObject) => {
    const parsedSize = sizeSchema.safeParse(query);
    const parsedFormat = formatSchema.safeParse(query.f);
    const format = parsedFormat.success ? parsedFormat.data : "png";

    // check version match
    if (typeof query.v === "string" && query.v !== cache?.version) {
      cache.content = null;
      cache.sizes = {};
      cache.version = query.v;
    }

    if (parsedSize.success) {
      const { w, h } = parsedSize.data;
      const sizeKey = `${w}x${h}` as const;
      if (!cache?.sizes[sizeKey]) {
        const file = await bufferGetter();

        // check if the cache is too big
        const keys = typedObjectKeys(cache.sizes);
        if (keys.length >= maxCachedSizes) {
          delete cache.sizes[keys[0]!];
        }

        cache.sizes[sizeKey] = {
          png: await sharp(file).resize(w, h).png().toBuffer(),
          webp: await sharp(file).resize(w, h).webp().toBuffer(),
          avif: await sharp(file).resize(w, h).avif().toBuffer(),
        };
      }
      return {
        format,
        size: { w, h },
        content: cache.sizes[sizeKey][format],
      };
    }

    if (!cache.content) {
      const file = await bufferGetter();

      cache.content = {
        png: await sharp(file).png().toBuffer(),
        webp: await sharp(file).webp().toBuffer(),
        avif: await sharp(file).avif().toBuffer(),
      };
    }

    cache.lastUsed = Date.now();

    return {
      format,
      content: cache.content,
    };
  };
}
