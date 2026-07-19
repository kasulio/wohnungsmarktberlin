import type { inferRouterOutputs } from "@trpc/server";
import type { Tags } from "~/data/tags";
import type { AppRouter } from "~/server/trpc/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Canonical shape for `flat.getAll` listings (map, overview, favorites). */
export type ListingFlat = RouterOutputs["flat"]["getAll"]["data"][number];

export type ListingFlatWithCoordinates = ListingFlat & {
  address: ListingFlat["address"] & { latitude: number; longitude: number };
};

export type ListingFlatImage = Pick<ListingFlat, "id" | "hasImage">;

export type ListingAddress = Pick<
  ListingFlat["address"],
  "street" | "streetNumber" | "postalCode" | "latitude" | "longitude"
>;

/**
 * Explicit props for Vue SFC `defineProps` — must not use `Pick<ListingFlat, …>`
 * (vue/compiler-sfc cannot resolve tRPC-inferred types).
 */
export type ListingCardProps = {
  id: string;
  title: string;
  address: ListingAddress;
  coldRentPrice: number | null;
  warmRentPrice: number | null;
  hasImage: boolean;
  tags: Tags;
  usableArea: number | null;
  url: string;
  firstSeen: Date;
  propertyManagementId?: string | null;
};

export type ListingCardDetailProps = ListingCardProps & {
  roomCount: number | null;
  floor?: number | null;
};

export type ListingDetailsProps = ListingCardDetailProps;

type ListingCardPropKeys = keyof ListingCardProps & keyof ListingFlat;
