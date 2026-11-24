import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Layer } from "effect";
import * as schema from "./schema";
import { Db, type DbClient } from "./service";

/** A fresh, fully migrated in-memory database. */
export function makeTestDb(): DbClient {
  const db = drizzle(new Database(":memory:"), { schema });
  migrate(db, { migrationsFolder: `${import.meta.dir}/../../drizzle` });
  return db;
}

export const testDbLayer = (db: DbClient) => Layer.succeed(Db, db);
