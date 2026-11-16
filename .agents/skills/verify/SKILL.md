---
name: verify
description: Run this app and drive it to prove a change works end to end. Use after changing pages, components, tRPC routers, tasks or scrapers, or when asked to run, check or screenshot the app.
---

`bun check` proves the code compiles and the unit tests pass. This skill proves the running app does what the change claims. Finish with **evidence**: output you observed, not output you expect.

## 1. Launch

Work in a worktree or clone that has been through `scripts/setup-worktree.sh`, which leaves a `.env` with its own `PORT` and `SCHEDULED_TASKS=off`, plus a SQLite copy. In the main checkout `.env` holds real credentials and cron scraping is on: use it only when the user says so.

```bash
PORT=$(grep '^PORT=' .env | cut -d= -f2)
bun dev > /tmp/dev-$PORT.log 2>&1 &   # background; first start takes ~20s
```

## 2. Doctor

Done when `curl -sf localhost:$PORT/api/health` returns `{"status":"ok"}`. Poll for up to 60s. If it fails, read the dev log: an env error names the missing variable (see `env.ts`); `EADDRINUSE` means another server holds the port, so pick a free one and update `PORT` and `DEPLOYMENT_URL` in `.env`.

## 3. Drive

Exercise the exact path the change touches, then one neighbouring path that it could break.

- **Pages**: `curl -s localhost:$PORT/<route>` returns server-rendered HTML; grep it for the text or data the change adds. Routes: `/`, `/overview`, `/map`, `/about`, `/login`, `/admin/dashboard`. With a browser tool available, open the page and check the console as well: client-only behaviour (filters, map, favorites) never shows in SSR HTML.
- **tRPC**: `curl -s 'localhost:$PORT/api/trpc/<router>.<procedure>'`, with input as `?input=<url-encoded JSON>`. No transformer, so the response is plain JSON under `result.data`.
- **Tasks**: cron is off, so run a task by hand: `curl -s localhost:$PORT/_nitro/tasks/<name>` (names in `server/tasks/`). `update-flats` and `extract-flats` hit live housing-company sites: run them once, never in a loop. `notify` only logs: worktrees have no `TELEGRAM_BOT_TOKEN`.
- **Admin**: `/admin/*` needs a session. Seed a throwaway admin into this DB, then log in at `/login`:
  `SEED_ADMIN_EMAIL=agent@example.com SEED_ADMIN_PASSWORD=agent-password-123 bun seed:admin`
- **DB state**: `sqlite3 server/db/sqlite.db '<query>'`. Visible listings: `deleted IS NULL AND ignored = 0 AND addressId IS NOT NULL`.
- **Scrapers**: fixture tests in `bun test`; live drift with `bun scrape:canary` (see `data/propertyManagements/TESTING.md`).

## 4. Evidence

Report each check as the command or action, then the observed result (status code, grepped line, JSON excerpt, screenshot path). A check you could not run is reported as skipped, with the reason.

## 5. Cleanup

Stop the server you started: `lsof -ti tcp:$PORT | xargs kill`. Leave the worktree DB as is; it is a disposable copy.
