import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "@better-auth/core/error";
import { username } from "better-auth/plugins";

import { env } from "~/env";
import { db } from "~/server/db/client";
import * as schema from "~/server/db/schema";

const trustedOrigins = Array.from(
  new Set([env.DEPLOYMENT_URL, env.BETTER_AUTH_URL, "http://localhost:3000"]),
);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: { enabled: true },
  plugins: [username()],
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          throw APIError.from("BAD_REQUEST", {
            code: "SIGN_UP_DISABLED",
            message: "Registrierung ist deaktiviert.",
          });
        },
      },
    },
  },
});
