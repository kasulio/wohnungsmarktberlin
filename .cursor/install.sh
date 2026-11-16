#!/usr/bin/env bash
# Cloud Agent bootstrap: install Bun if the image lacks it, then the shared setup.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
  sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bunx
fi
bun --version

scripts/setup-worktree.sh
