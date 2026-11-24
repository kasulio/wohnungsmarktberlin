import { Clock, Effect } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { scraperRun } from "~/server/db/schema";
import { query } from "~/server/db/service";

export type RunOutcome<S> = {
  success: boolean;
  stats: S;
  errorMessage?: string | null;
};

export type RunMeta = {
  kind: "update-flats" | "extract-flats" | "admin-scrape";
  trigger: "scheduled" | "admin";
  propertyManagementId?: PropertyManagementId | null;
};

/** Runs `run` and records its outcome and duration as a `scraperRun` row. */
export const loggedRun = <S, E, R>(
  meta: RunMeta,
  run: Effect.Effect<RunOutcome<S>, E, R>,
) =>
  Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis;
    const outcome = yield* run;
    const finished = yield* Clock.currentTimeMillis;
    yield* query("log scraper run", (db) =>
      db.insert(scraperRun).values({
        kind: meta.kind,
        propertyManagementId: meta.propertyManagementId ?? null,
        success: outcome.success,
        statsJson: JSON.stringify(outcome.stats),
        errorMessage: outcome.errorMessage ?? null,
        durationMs: finished - started,
        trigger: meta.trigger,
        createdAt: new Date(finished),
      }),
    );
    return outcome;
  });
