import { hashPassword } from "better-auth/crypto";

import { db } from "../server/db/client";
import { account, user } from "../server/db/schema";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const displayName = process.env.SEED_ADMIN_NAME ?? "Admin";
const password = process.env.SEED_ADMIN_PASSWORD;

if (!password) {
  console.error(
    "Set SEED_ADMIN_PASSWORD in the environment (and optionally SEED_ADMIN_EMAIL, SEED_ADMIN_NAME).",
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

const passwordHash = await hashPassword(password);

const inserted = await db
  .insert(user)
  .values({
    name: displayName,
    email,
    emailVerified: true,
  })
  .returning();

const newUser = inserted[0];
if (!newUser) {
  console.error("Failed to insert admin user (no row returned).");
  process.exit(1);
}

await db.insert(account).values({
  accountId: newUser.id,
  providerId: "credential",
  userId: newUser.id,
  password: passwordHash,
});

console.info(`Seeded admin user: ${email}.`);
