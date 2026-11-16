#!/usr/bin/env bash
# Idempotent dev bootstrap for a fresh clone or git worktree:
# .env with placeholders, deps, and a SQLite DB of its own.
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
    port=3001
    while lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 \
      || grep -qs "^PORT=$port$" "$main_checkout"/../*/.env 2>/dev/null; do
      port=$((port + 1))
    done
  fi
  # Never copies the main checkout's .env: it may hold real API keys and the
  # Telegram bot token. Without TELEGRAM_BOT_TOKEN the telegram channel is off.
  cat > .env <<EOF
GOOGLE_MAPS_API_KEY=dev-placeholder
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=dev-placeholder
NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID=dev-placeholder
LOCAL_SQLITE_PATH=./$db_path
BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef
PORT=$port
DEPLOYMENT_URL=http://localhost:$port
EOF
  echo "wrote .env (PORT=$port)"
fi

bun install

if [ ! -f "$db_path" ] && [ "$empty_db" = false ] \
  && [ "$main_checkout" != "$(pwd)" ] && [ -f "$main_checkout/$db_path" ]; then
  # A copy, not a symlink: worktrees must not write to the main DB.
  sqlite3 "$main_checkout/$db_path" ".backup '$db_path'" 2>/dev/null \
    || cp "$main_checkout/$db_path" "$db_path"
  echo "copied DB from $main_checkout"
fi

# `bun db:migrate` dedupes flats before migrating, which throws on an empty DB
# (no `flat` table yet), so apply migrations directly.
bun -e 'import { migrate } from "drizzle-orm/bun-sqlite/migrator"; import { db } from "./server/db/client.ts"; migrate(db, { migrationsFolder: "./drizzle" });'
echo "setup done; start with: bun dev"
