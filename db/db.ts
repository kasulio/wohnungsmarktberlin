import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { env } from "~/env";

export const db = drizzle(
  new Database(env.LOCAL_SQLITE_PATH ?? "db/sqlite.db"),
  {
    schema,
  },
);
