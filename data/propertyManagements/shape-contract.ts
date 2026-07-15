import { scrapedFlatSchema, type ScrapedFlat } from "~/data/schemas";

export function assertFlatShape(flat: ScrapedFlat, ctx: string): void {
  const parsed = scrapedFlatSchema.safeParse(flat);
  if (!parsed.success) {
    throw new Error(
      `${ctx}: schema validation failed: ${parsed.error.message}`,
    );
  }

  if (!flat.title.trim()) {
    throw new Error(`${ctx}: title is empty`);
  }

  if (!flat.addressText.trim()) {
    throw new Error(`${ctx}: addressText is empty`);
  }

  if (flat.coldRentPrice == null || flat.coldRentPrice <= 0) {
    throw new Error(
      `${ctx}: coldRentPrice must be > 0, got ${flat.coldRentPrice}`,
    );
  }

  if (flat.roomCount == null || flat.roomCount < 1) {
    throw new Error(`${ctx}: roomCount must be >= 1, got ${flat.roomCount}`);
  }

  if (flat.usableArea == null || flat.usableArea <= 0) {
    throw new Error(`${ctx}: usableArea must be > 0, got ${flat.usableArea}`);
  }

  if (flat.warmRentPrice != null && flat.warmRentPrice < flat.coldRentPrice) {
    throw new Error(
      `${ctx}: warmRentPrice (${flat.warmRentPrice}) must be >= coldRentPrice (${flat.coldRentPrice})`,
    );
  }

  if (flat.imageUrl != null && !/^https?:\/\//.test(flat.imageUrl)) {
    throw new Error(
      `${ctx}: imageUrl must match ^https?://, got ${flat.imageUrl}`,
    );
  }

  if (flat.floor != null) {
    if (!Number.isInteger(flat.floor)) {
      throw new Error(`${ctx}: floor must be an integer, got ${flat.floor}`);
    }
    if (flat.floor < -5 || flat.floor > 50) {
      throw new Error(`${ctx}: floor must be in -5..50, got ${flat.floor}`);
    }
  }
}
