import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db } from "./client";
import { ensureFlatsFiltered } from "~/server/lib/ensure-flats-filtered";

await ensureFlatsFiltered();
migrate(db, { migrationsFolder: "./drizzle" });
