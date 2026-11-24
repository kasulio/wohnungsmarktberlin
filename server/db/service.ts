import { Context, Data, Effect } from "effect";
import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./schema";

export type DbClient = BunSQLiteDatabase<typeof schema>;

export class Db extends Context.Service<Db, DbClient>()("Db") {}

export class DbError extends Data.TaggedError("DbError")<{
  op: string;
  cause: unknown;
  message: string;
}> {}

export const query = <A>(op: string, run: (db: DbClient) => Promise<A>) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* Effect.tryPromise({
      try: () => run(db),
      catch: (cause) =>
        new DbError({
          op,
          cause,
          message: `Database error (${op}): ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
    });
  });
