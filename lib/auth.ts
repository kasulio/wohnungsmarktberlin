import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "~/env";
import { db } from "~/server/db/client";
import * as schema from "~/server/db/schema";

const siteUrl = env.DEPLOYMENT_URL;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: siteUrl,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true },
});
