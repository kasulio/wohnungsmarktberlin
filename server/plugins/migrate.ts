import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createLogger } from "~/lib/logger";
import { db } from "~/server/db/client";
import { ensureFlatsFiltered } from "~/server/lib/ensure-flats-filtered";

const log = createLogger("plugin:migrate");

export default defineNitroPlugin(async () => {
  await ensureFlatsFiltered();
  migrate(db, { migrationsFolder: "./drizzle" });
  log.info("migrations applied");
});
