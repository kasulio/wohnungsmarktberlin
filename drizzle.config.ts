import type { Config } from "drizzle-kit";
import { env } from "./env";

export default {
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: env.LOCAL_SQLITE_PATH!,
  },
} satisfies Config;
