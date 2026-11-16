import { Effect, Layer } from "effect";
import { propertyManagements } from "~/data/propertyManagements";
import { Http } from "~/lib/http";
import { db } from "~/server/db/client";
import { Db } from "~/server/db/service";
import { runAddressImprovement } from "~/server/lib/address-improvement";
import { AddressImprovement, Scrapers } from "./services";

export const ScraperLive = Layer.mergeAll(
  Layer.succeed(Db, db),
  Http.live,
  Layer.succeed(Scrapers, propertyManagements),
  Layer.succeed(AddressImprovement, { run: () => runAddressImprovement() }),
);

type LiveServices = Layer.Success<typeof ScraperLive>;

/** The Promise edge for Nitro tasks and tRPC. */
export const runScraper = <A, E>(effect: Effect.Effect<A, E, LiveServices>) =>
  Effect.runPromise(Effect.provide(effect, ScraperLive));
