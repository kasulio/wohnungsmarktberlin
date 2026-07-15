import { eq, lt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { telegramLinkToken } from "~/server/db/schema";
import { type FlatFilter } from "~/lib/flat-filters";

/** Tokens older than this are considered stale and swept on the next mint. */
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function tokenCutoff(): Date {
  return new Date(Date.now() - TOKEN_TTL_MS);
}

/**
 * Mint a single-use token carrying `filter`, persisted for the bot to consume on
 * `/start <token>`. Returns a short, url-safe token (fits Telegram's 64-char
 * start-param limit). Opportunistically prunes expired tokens.
 */
export async function mintLinkToken(
  filter: FlatFilter | null,
): Promise<string> {
  const token = crypto.randomUUID().replaceAll("-", "");
  await db.insert(telegramLinkToken).values({
    token,
    filterJson: filter,
    createdAt: new Date(),
  });
  await db
    .delete(telegramLinkToken)
    .where(lt(telegramLinkToken.createdAt, tokenCutoff()));
  return token;
}

/**
 * Consume a token: returns its filter and deletes the row so it can't be reused.
 * Returns `null` if the token is unknown, already spent, or past TTL.
 */
export async function consumeLinkToken(
  token: string,
): Promise<{ filter: FlatFilter | null } | null> {
  const [row] = await db
    .delete(telegramLinkToken)
    .where(eq(telegramLinkToken.token, token))
    .returning();
  if (!row) return null;
  if (row.createdAt.getTime() < tokenCutoff().getTime()) return null;
  return { filter: row.filterJson };
}
