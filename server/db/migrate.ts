import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db } from "./client";
import { ensureFlatsFiltered } from "~/server/lib/ensure-flats-filtered";

migrate(db, { migrationsFolder: "./drizzle" });
await ensureFlatsFiltered();
