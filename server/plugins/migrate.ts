import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "~/server/db/client";

export default defineNitroPlugin(() => {
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[plugin:migrate] Migrations applied");
});
