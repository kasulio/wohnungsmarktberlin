import { createEnv } from "@t3-oss/env-nuxt";
import { z } from "zod";

export const env = createEnv({
  server: {
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    LOCAL_SQLITE_PATH: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    DEPLOYMENT_URL: z
      .string()
      .min(1)
      .optional()
      .default("http://localhost:3000"),
    /** Telegram bot token from BotFather. Optional: absent = telegram channel disabled. */
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    /** Bot username (without @), used to build `t.me/<username>?start=…` deep links. */
    TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
    /**
     * Secret Telegram echoes as `X-Telegram-Bot-Api-Secret-Token`.
     * Required in production whenever `TELEGRAM_BOT_TOKEN` is set (plugin throws otherwise).
     * Telegram only allows A-Z, a-z, 0-9, _ and - (1–256 chars). No base64.
     */
    TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .min(1)
      .max(256)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "TELEGRAM_WEBHOOK_SECRET: only A-Z, a-z, 0-9, _ and - allowed (Telegram API)",
      )
      .optional(),
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
