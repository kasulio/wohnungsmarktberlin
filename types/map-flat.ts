import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/trpc/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type MapFlat = RouterOutputs["flat"]["getAll"]["data"][number];

export type MapFlatWithCoordinates = MapFlat & {
  address: MapFlat["address"] & { latitude: number; longitude: number };
};

export function hasMapCoordinates(
  flat: MapFlat,
): flat is MapFlatWithCoordinates {
  const { latitude, longitude } = flat.address;
  return latitude != null && longitude != null;
}
