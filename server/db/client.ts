import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { env } from "../../env";

const sqlite = new Database(env.LOCAL_SQLITE_PATH);
// WAL + busy_timeout prevent SQLITE_BUSY when 1-minute crons, web requests and
// Telegram webhooks write concurrently.
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA busy_timeout = 5000;");
sqlite.run("PRAGMA synchronous = NORMAL;");

export const db = drizzle(sqlite, {
  schema,
});

/** Close the underlying bun:sqlite handle (idempotent). */
export function closeDb() {
  sqlite.close(false);
}
