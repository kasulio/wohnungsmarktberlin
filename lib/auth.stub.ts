/**
 * Minimal Better Auth config for `@better-auth/cli generate` only (Node/jiti;
 * must not import `bun:sqlite`). Production: `~/lib/auth.ts`.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

const db = {} as Parameters<typeof drizzleAdapter>[0];

export const auth = betterAuth({
  secret: "01234567890123456789012345678901",
  baseURL: "http://localhost:3000",
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  plugins: [username()],
});
