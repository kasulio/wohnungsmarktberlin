import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "~/server/db/client";
import { ensureFlatsFiltered } from "~/server/lib/ensure-flats-filtered";

export default defineNitroPlugin(async () => {
  await ensureFlatsFiltered();
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[plugin:migrate] Migrations applied");
});
