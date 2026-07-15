import { createEnv } from "@t3-oss/env-nuxt";
import { z } from "zod";
import dotenv from "dotenv";
if (process.env.ENV_FILE_PATH) {
  dotenv.config({
    path: process.env.ENV_FILE_PATH,
  });
} else {
  dotenv.config();
}

export const env = createEnv({
  server: {
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    LOCAL_SQLITE_PATH: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    DEPLOYMENT_URL: z
      .string()
      .min(1)
      .optional()
      .prefault("http://localhost:3000"),
    /** Max flatUrl jobs processed per admin full / extract_only run (tasks unchanged). */
    ADMIN_SCRAPER_EXTRACT_BATCH: z
      .string()
      .optional()
      .transform((s) => {
        if (s === undefined || s === "") return 40;
        const n = Number.parseInt(s, 10);
        if (!Number.isFinite(n) || n < 1) return 40;
        return Math.min(500, n);
      }),
  },
  client: {
    NUXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
    NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().min(1),
  },
});
