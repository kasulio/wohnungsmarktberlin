# Development Guide for Hausverwaltungs-Finder

Nuxt 4 app with TypeScript, SQLite/Drizzle, tRPC, and Bun runtime.

**Docs index:** [docs/README.md](docs/README.md)

**Full codebase overview for agents:** [docs/AGENT-OVERVIEW.md](docs/AGENT-OVERVIEW.md)

**Post-refactor cleanup backlog:** [docs/cleanup-backlog.md](docs/cleanup-backlog.md)

## Commands

```bash
bun dev                    # Start dev server
bun build                  # Build for production
bun typecheck              # Type check
bun db:generate            # Generate migrations
bun db:migrate             # Run migrations
```

## Project Structure

- `/server/api` - API endpoints
- `/server/db` - Database schema & client
- `/server/trpc` - tRPC routers
- `/components` - Vue components
- `/pages` - Nuxt pages (file-based routing)
- `/composables` - Composition functions
- `/utils` - Utility functions

## Code Style

- TypeScript: Use inline type imports (`import { type SomeType }`)
- Use `type` over `interface`
- Runtime validation: Zod only
- Vue components: `<script setup lang="ts">`
- Components: PascalCase file names
- Composables: Prefix with `use`
- Imports: Use `~/` for project root
- Indentation: 2 spaces, double quotes, semicolons required

## Important

- Use `bun` commands (not npm/yarn)
- Auto-imports enabled for components, composables, and utils
- Server API routes: Place in `/server/api/`
- Database types: Infer from Drizzle schemas using `typeof table.$inferSelect`

## Cursor Cloud specific instructions

Cloud env lives in [`.cursor/environment.json`](.cursor/environment.json) (Dockerfile + `install` + `bun dev` terminal).

**Update script:** `bash .cursor/install.sh` installs Bun if needed, writes `.env` when missing, runs `bun install --frozen-lockfile`, then `bun db:migrate`.

**Secrets** (Cursor Dashboard → Cloud Agents → Secrets; preferred over committing `.env`):

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_MAPS_API_KEY` | yes | Server Maps/Geocoding |
| `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | yes | Client Maps |
| `NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | yes | Map ID |
| `BETTER_AUTH_SECRET` | yes | ≥32 chars (`openssl rand -base64 32`) |
| `LOCAL_SQLITE_PATH` | optional | default `./server/db/sqlite.db` |
| `DEPLOYMENT_URL` | optional | default `http://localhost:3000` |
| `TELEGRAM_*` | optional | bot disabled if unset |

Without real Maps secrets, install writes placeholders so typecheck/dev boot; map UI/geocoding fail until secrets set.

**Verify after setup:** `bun typecheck`, `bun test`, `bun dev` (port 3000).
