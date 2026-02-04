import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db } from "./client";

migrate(db, { migrationsFolder: "./drizzle" });
