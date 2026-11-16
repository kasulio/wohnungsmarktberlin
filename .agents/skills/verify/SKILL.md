---
name: verify
description: Run this app and drive it to prove a change works end to end. Use after changing pages, components, tRPC routers, tasks or scrapers, or when asked to run, check or screenshot the app.
---

`bun check` proves the code compiles and the unit tests pass. This skill proves the running app does what the change claims. Finish with **evidence**: output you observed, not output you expect.

## 1. Launch

No `node_modules` or `.env` yet means setup has not run: `scripts/setup-worktree.sh`. Its default is right for agents: it only _reads_ the main checkout's DB and gives this checkout a scrubbed copy (real listings, no accounts, no subscribers). `--empty-db` is for when no main DB exists.

```bash
PORT=$(bun -e 'console.log(process.env.PORT)')   # Bun loads .env; no need to read it
```

Start `bun dev` with your harness's background-process mode (a plain `cmd &` dies with the shell call) and send its output to a log file. Startup takes 2-25s.

## 2. Doctor

Done when `curl -s localhost:$PORT/api/health` reports `"status": "ok"` **and** `"root"` equals this checkout's `pwd`. A different `root` means another worktree's server answered on this port: stop yours, set a free `PORT` and `DEPLOYMENT_URL` in `.env`, restart. Use `localhost`, not `127.0.0.1`: the server may listen on IPv6 only. Startup errors (env validation, ports) are in the dev log.

## 3. Drive

Exercise the exact path the change touches, then one neighbouring path that it could break.

- **Pages**: `curl -s localhost:$PORT/<route>` returns server-rendered HTML; grep it for what the change adds. Routes: `/`, `/overview`, `/map`, `/about`, `/login`, `/admin/dashboard`. Client-only behaviour (filters, map, favorites, hydration errors) never shows in SSR HTML: for those, open the page in a browser tool and check the console, or report it as unchecked.
- **tRPC**: no transformer, plain JSON. Query: `curl -s 'localhost:$PORT/api/trpc/<router>.<proc>?input=<url-encoded JSON>'` → `result.data`. Mutation: `POST` with the JSON input as body.
- **Login** (protected procedures, `/admin`): "protected" means any signed-in user.
  ```bash
  SEED_ADMIN_EMAIL=agent@example.com SEED_ADMIN_PASSWORD=agent-password-123 bun seed:admin
  curl -s -c /tmp/jar-$PORT -H "origin: http://localhost:$PORT" -H 'content-type: application/json' \
    -d '{"email":"agent@example.com","password":"agent-password-123"}' localhost:$PORT/api/auth/sign-in/email
  ```
  Then pass `-b /tmp/jar-$PORT`. Prove auth on tRPC (401 without the jar, 200 with it); curl on `/admin/*` redirects to `/login` even with the jar, so check admin pages in a browser.
- **Tasks**: cron is off; run one by hand with `curl -s localhost:$PORT/_nitro/tasks/<name>` (names in `server/tasks/`). `update-flats` syncs whichever company is next in round-robin, `extract-flats` fetches pending jobs of any company: both hit live sites, so run them once.
- **One company, live**: signed in, `POST /api/trpc/propertyManagement.update` with `{"slugs":["<slug>"],"mode":"full"}` (or `sync_only` / `extract_only`). Extraction fires up to `ADMIN_SCRAPER_EXTRACT_BATCH` (default 40) requests back to back: set it to 5 in `.env` before starting the server.
- **Notifications**: the copy has no subscribers and no `TELEGRAM_BOT_TOKEN`, so nothing reaches anyone. To see a delivery without touching live sites, add a log subscriber, mark one visible flat as not yet stamped, and run the sweep:
  ```sql
  INSERT INTO notificationSubscriber (id, channel, target, filterJson, active, createdAt)
  VALUES ('log:agent', 'log', 'agent', '{}', 1, strftime('%s','now') - 5);
  UPDATE flat SET firstPublishableAt = NULL WHERE id = '<a visible flat id>';
  ```
  then `curl -s localhost:$PORT/_nitro/tasks/notify`. Deliveries print `[notify] (log:agent) …` in the dev log and land in `notificationSent`; code-defined `log:*` subscribers print too. The sweep also runs after address improvement and extract runs, so those deliver as well.
- **DB state**: `sqlite3 server/db/sqlite.db '<query>'`. Visible = `publishableFlatFilter()` in `lib/flat-publishability.ts` = `deleted IS NULL AND ignored = 0 AND addressId IS NOT NULL`.
- **Scrapers**: fixture tests in `bun test`; live drift with `bun scrape:canary --only <slug>` (see `data/propertyManagements/TESTING.md`).

## 4. Evidence

Report each check as the command or action, then the observed result (status code, grepped line, JSON excerpt, screenshot path). A check you could not run is reported as unchecked, with the reason.

## 5. Cleanup

Stop the server you started (match the PID whose cwd is this checkout before killing). Leave the DB as is; it is a disposable copy.
