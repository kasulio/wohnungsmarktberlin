#!/usr/bin/env bash
# Idempotent dev bootstrap for a fresh clone or git worktree:
# .env with placeholders, deps, and a SQLite DB of its own (a scrubbed copy of
# the main checkout's listings; the main DB is only read).
#
#   scripts/setup-worktree.sh            copy the main checkout's DB if there is one
#   scripts/setup-worktree.sh --empty-db migrate an empty DB instead
set -euo pipefail
cd "$(dirname "$0")/.."

empty_db=false
[ "${1:-}" = "--empty-db" ] && empty_db=true

main_checkout="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
db_path="server/db/sqlite.db"

if [ ! -f .env ]; then
  if [ "$main_checkout" = "$(pwd)" ]; then
    port=3000
  else
    # Derived from the worktree path so parallel worktrees get distinct ports
    # even before any of them has started a server.
    port=$((3100 + $(printf '%s' "$(pwd)" | cksum | cut -d' ' -f1) % 800))
    while lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
      port=$((port + 1))
    done
  fi
  # Never copies the main checkout's .env: it may hold real API keys and the
  # Telegram bot token. Without TELEGRAM_BOT_TOKEN the telegram channel is off.
  # SCHEDULED_TASKS=off keeps every extra dev server from scraping live sites.
  cat > .env <<EOF
GOOGLE_MAPS_API_KEY=dev-placeholder
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=dev-placeholder
NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID=dev-placeholder
LOCAL_SQLITE_PATH=./$db_path
BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef
PORT=$port
DEPLOYMENT_URL=http://localhost:$port
SCHEDULED_TASKS=off
EOF
  echo "wrote .env (PORT=$port)"
fi

bun install

if [ ! -f "$db_path" ] && [ "$empty_db" = false ] \
  && [ "$main_checkout" != "$(pwd)" ] && [ -f "$main_checkout/$db_path" ]; then
  # A copy, not a symlink: worktrees must not write to the main DB.
  sqlite3 "$main_checkout/$db_path" ".backup '$db_path'" 2>/dev/null \
    || cp "$main_checkout/$db_path" "$db_path"
  copied=true
fi

# `bun db:migrate` dedupes flats before migrating, which throws on an empty DB
# (no `flat` table yet), so apply migrations directly.
bun -e 'import { migrate } from "drizzle-orm/bun-sqlite/migrator"; import { db } from "./server/db/client.ts"; migrate(db, { migrationsFolder: "./drizzle" });'

if [ "${copied:-false}" = true ]; then
  # The main DB is often weeks old, so its flats are pruned as stale and every
  # page is empty. Shift timestamps so the last scrape is "now" and restore
  # the flats that were live at that scrape.
  sqlite3 "$db_path" "
    CREATE TEMP TABLE shift AS
      SELECT strftime('%s','now') - max(lastSeen) AS d FROM flat;
    UPDATE flat SET
      firstSeen = firstSeen + (SELECT d FROM shift),
      lastSeen = lastSeen + (SELECT d FROM shift),
      firstPublishableAt = firstPublishableAt + (SELECT d FROM shift);
    UPDATE flat SET deleted = NULL
      WHERE lastSeen >= strftime('%s','now') - 86400;"
  # The copy must not reach real people or carry real accounts: drop auth rows
  # and notification targets, keeping the listing data. Pending jobs go too, so
  # the next extract only fetches what the agent's own sync enqueues.
  sqlite3 "$db_path" "
    DELETE FROM notificationSent; DELETE FROM notificationSubscriber;
    DELETE FROM telegramLinkToken; DELETE FROM session; DELETE FROM account;
    DELETE FROM verification; DELETE FROM user; DELETE FROM signups;
    DELETE FROM flatUrlJob WHERE status = 'pending';
    VACUUM;"
  echo "copied DB from $main_checkout ($(sqlite3 "$db_path" \
    "SELECT count(*) FROM flat WHERE deleted IS NULL AND ignored = 0 AND addressId IS NOT NULL") visible flats)"
fi
echo "setup done; start with: bun dev"
