import { hashPassword } from "better-auth/crypto";

import { db } from "../server/db/client";
import { account, user } from "../server/db/schema";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
const displayName = process.env.SEED_ADMIN_NAME ?? "Admin";
const password = process.env.SEED_ADMIN_PASSWORD;

if (!password) {
  console.error(
    "Set SEED_ADMIN_PASSWORD in the environment (and optionally SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_NAME).",
  );
  process.exit(1);
}

const existing = await db.query.user.findFirst({
  where: (u, { eq: eqFn }) => eqFn(u.email, email),
});

if (existing) {
  console.info("Admin user already exists for this email; skipping.");
  process.exit(0);
}

const userId = Bun.randomUUIDv7();
const passwordHash = await hashPassword(password);

await db.insert(user).values({
  id: userId,
  name: displayName,
  email,
  emailVerified: true,
  username,
  displayUsername: username,
});

await db.insert(account).values({
  id: Bun.randomUUIDv7(),
  accountId: userId,
  providerId: "credential",
  userId,
  password: passwordHash,
});

console.info(`Seeded admin user: ${username} (${email}).`);
