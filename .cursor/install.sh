#!/usr/bin/env bash
# Idempotent Cursor Cloud update script (runs from repo root).
set -euo pipefail

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="${BUN_INSTALL}/bin:/usr/local/bun/bin:/usr/local/bin:${PATH}"

if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Materialize .env from Cursor Secrets / process env when missing.
# Required keys: see .env.sample and AGENTS.md (Cursor Cloud section).
if [[ ! -f .env ]]; then
  auth_secret="${BETTER_AUTH_SECRET:-}"
  if [[ ${#auth_secret} -lt 32 ]]; then
    auth_secret="$(openssl rand -base64 32)"
  fi
  cat > .env <<EOF
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY:-cloud-dev-placeholder}
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NUXT_PUBLIC_GOOGLE_MAPS_API_KEY:-cloud-dev-placeholder}
NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID=${NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID:-cloud-dev-placeholder}
LOCAL_SQLITE_PATH=${LOCAL_SQLITE_PATH:-./server/db/sqlite.db}
BETTER_AUTH_SECRET=${auth_secret}
DEPLOYMENT_URL=${DEPLOYMENT_URL:-http://localhost:3000}
EOF
  echo "Wrote .env (placeholders used where secrets unset)."
fi

bun install --frozen-lockfile
bun db:migrate

echo "Cloud install complete. bun=$(bun --version)"
