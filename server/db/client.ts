import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { env } from "../../env";

const sqlite = new Database(env.LOCAL_SQLITE_PATH);

export const db = drizzle(sqlite, {
  schema,
});

/** Close the underlying bun:sqlite handle (idempotent). */
export function closeDb() {
  sqlite.close(false);
}
