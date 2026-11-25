import { lt } from "drizzle-orm";
import { Clock, Effect } from "effect";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { db as liveDb } from "~/server/db/client";
import { scraperRun } from "~/server/db/schema";
import { type DbClient, query } from "~/server/db/service";

export type RunOutcome<S> = {
  success: boolean;
  stats: S;
  errorMessage?: string | null;
};

export type RunKind =
  | "update-flats"
  | "extract-flats"
  | "admin-scrape"
  | "address-improvement"
  | "notify"
  | "update-map-preview";

export type RunMeta = {
  kind: RunKind;
  trigger: "scheduled" | "admin";
  propertyManagementId?: PropertyManagementId | null;
};

const RUN_LOG_RETENTION_DAYS = 30;
const PRUNE_INTERVAL_MS = 60 * 60_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
let lastPrunedAt = 0;

async function pruneOldRunsIfDue(db: DbClient, nowMs: number) {
  if (nowMs - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = nowMs;
  const cutoff = new Date(nowMs - RUN_LOG_RETENTION_DAYS * MS_PER_DAY);
  await db.delete(scraperRun).where(lt(scraperRun.createdAt, cutoff));
}

/** Runs `run` and records its outcome and duration as a `scraperRun` row. */
export const loggedRun = <S, E, R>(
  meta: RunMeta,
  run: Effect.Effect<RunOutcome<S>, E, R>,
) =>
  Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis;
    const outcome = yield* run;
    const finished = yield* Clock.currentTimeMillis;
    yield* query("log scraper run", async (db) => {
      await db.insert(scraperRun).values({
        kind: meta.kind,
        propertyManagementId: meta.propertyManagementId ?? null,
        success: outcome.success,
        statsJson: JSON.stringify(outcome.stats),
        errorMessage: outcome.errorMessage ?? null,
        durationMs: finished - started,
        trigger: meta.trigger,
        createdAt: new Date(finished),
      });
      await pruneOldRunsIfDue(db, finished);
    });
    return outcome;
  });

/** Promise helper for non-Effect tasks (geocoding, notify, map preview). */
export async function recordScraperRun(params: {
  kind: RunKind;
  trigger: "scheduled" | "admin";
  propertyManagementId?: PropertyManagementId | null;
  success: boolean;
  stats: unknown;
  errorMessage?: string | null;
  durationMs: number;
  db?: DbClient;
}) {
  const targetDb = params.db ?? liveDb;
  const nowMs = Date.now();
  await targetDb.insert(scraperRun).values({
    kind: params.kind,
    propertyManagementId: params.propertyManagementId ?? null,
    success: params.success,
    statsJson: JSON.stringify(params.stats),
    errorMessage: params.errorMessage ?? null,
    durationMs: params.durationMs,
    trigger: params.trigger,
    createdAt: new Date(nowMs),
  });
  await pruneOldRunsIfDue(targetDb, nowMs);
}
