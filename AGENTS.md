# WohnungsMarktBerlin

Aggregates Berlin rental listings scraped from public housing companies (Hausverwaltungen). Nuxt 4, Vue 3, TypeScript, Bun, SQLite + Drizzle, tRPC, Better Auth, Tailwind, grammy (Telegram).

Domain words (Flat, PM, publishable, ignored, canary, …): [docs/GLOSSARY.md](docs/GLOSSARY.md). Where code lives and how data flows: [docs/AGENT-OVERVIEW.md](docs/AGENT-OVERVIEW.md).

## Setup

A checkout without `node_modules` or `.env` needs `scripts/setup-worktree.sh` first (T3's `runOnWorktreeCreate` and `.cursor/install.sh` run it where they can). It writes a placeholder `.env` with a port derived from the checkout path and `SCHEDULED_TASKS=off`, installs deps, and builds a local DB: a copy of the main checkout's listings with accounts, subscribers and pending jobs removed, timestamps shifted so listings are visible. The main DB is only read. `--empty-db` migrates an empty DB instead.

## Verifying

- `bun check` is the gate before every commit: format check, ESLint, vue-tsc, `bun test`. CI runs the same.
- `bun fmt` formats (Bun's built-in Prettier-compatible formatter, reads `.prettierrc`); `bun lint --fix` fixes lint.
- To see a change working in the running app, use the `verify` skill (`.agents/skills/verify`).
- The lefthook pre-commit hook formats and lints staged files.

## Ways to hurt yourself

- **Dev servers scrape live sites.** Nitro runs the cron tasks in dev too: every minute, scraping one housing company, extracting pages and geocoding via Photon. Worktree `.env` files set `SCHEDULED_TASKS=off`; keep it that way and trigger single tasks by hand (`/_nitro/tasks/<name>`).
- **The main checkout is production-shaped.** Its `.env` may hold the real Telegram bot token and its `server/db/sqlite.db` holds real subscribers and admin accounts. Work in a worktree; never commit `.env` or `*.db` (the repo is public). A worktree that gets a real `TELEGRAM_BOT_TOKEN` messages whoever is in its `notificationSubscriber` table.
- **`bun db:migrate` crashes on an empty DB**, because it dedupes flats before migrating. The setup script applies migrations directly.
- **vue-tsc is pinned to 3.3.13**: 3.3.14 reports false errors on nested refs in templates. `bun check` runs the package script; Bun's built-in checker of the same name skips `.vue` files.
- **Schema changes**: edit `server/db/schema.ts`, then `bun db:generate`, and commit the generated `drizzle/` migration. Migrations auto-apply on server start.
- **Scrapers**: change a parser against a fixture first (`data/propertyManagements/TESTING.md`); `bun scrape:canary --only <slug>` hits that company's live site, so run it once per change.

## Conventions

- `bun` for everything (not npm/yarn); `~/` imports from the project root.
- `type` over `interface`; inline type imports (`import { type Foo }`); ESLint enforces both.
- Zod for runtime validation; the Drizzle schema is the DB source of truth; infer row types with `typeof table.$inferSelect`.
- Vue: `<script setup lang="ts">`, PascalCase component files, `use*` composables. Components, composables and `utils/` are auto-imported.
- Comments only where the code would surprise a reader; the why of a change goes in the commit message.
- Leave `composables/useUrlState.ts`'s typing as it is unless the task is about it.

## Work tracking

Issues live on GitHub at `kasulio/wohnungsmarktberlin` (use `gh`). Open issues, PRs or pushes only when asked. Follow-ups too small for an issue go in [docs/cleanup-backlog.md](docs/cleanup-backlog.md).
