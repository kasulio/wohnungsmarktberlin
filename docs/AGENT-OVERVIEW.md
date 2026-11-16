# Agent Overview — Hausverwaltungs-Finder

Quick orientation for AI agents working in this repo.

**Product:** WohnungsMarktBerlin — aggregates Berlin rental listings scraped from public housing companies (Hausverwaltungen).  
**Stack:** Nuxt 4, Vue 3, TypeScript, Bun, SQLite + Drizzle, tRPC, Better Auth, Tailwind.

---

## Where to Start

| Task                             | Start here                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Add/fix a scraper                | `data/propertyManagements/` → copy existing PM file                           |
| Change listing display/filters   | `pages/overview.vue`, `components/Filters.vue`, `server/trpc/routers/flat.ts` |
| Change map behavior              | `pages/map.vue`, `composables/useMapFlats.ts`, `components/Map/`              |
| DB schema change                 | `server/db/schema.ts` → `bun db:generate` → `bun db:migrate`                  |
| Admin scraper controls           | `pages/admin/dashboard.vue`, `server/trpc/routers/propertyManagement.ts`      |
| Scheduled background work        | `server/tasks/`, cron config in `nuxt.config.ts`                              |
| Scraper tests / live drift check | `data/propertyManagements/scrapers.test.ts`, `bun scrape:canary`              |
| Telegram / notification pipeline | `docs/listing-pipeline-design.md`                                             |
| Auth / admin access              | `lib/auth.ts`, `middleware/admin.global.ts`, `scripts/seed-admin-auth.ts`     |

---

## Directory Layout

```
hausverwaltungs-finder/
├── pages/                  # File-based routes (7 pages)
├── components/             # Vue UI (Apartment/, Map/, Icon/, layout chrome)
├── composables/            # useUrlState, useMapFlats, useFavorites, etc.
├── layouts/default.vue     # PageHeader + main + PageFooter
├── middleware/             # admin.global.ts — protects /admin/*
├── plugins/client.ts       # tRPC client ($client)
├── data/                   # Static data, scraper configs, HTML fixtures
│   ├── propertyManagements/  # One file per housing company scraper
│   ├── fixtures/             # Curated HTML fixtures + expected.ts for tests
│   ├── districts.ts          # Berlin districts → zip codes
│   ├── tags.ts               # Tag enum + title keyword mapping (read-time)
│   └── schemas.ts            # Zod schemas, PropertyManagement interface
├── lib/                    # Shared logic (auth, http, flat-utils, photon)
├── utils/                  # Formatting helpers (price, area, rooms)
├── types/                  # listing-flat.ts — tRPC-inferred types
├── server/
│   ├── api/                # REST: trpc, auth, image
│   ├── trpc/               # Routers, context, procedures
│   ├── db/                 # schema, client, migrate
│   ├── lib/scraper/        # sync-listings, process-flat-url-jobs
│   ├── tasks/              # Nitro scheduled tasks (cron)
│   ├── plugins/            # Startup: migrate, seed PMs
│   └── routes/             # Non-/api routes (stats proxy)
├── scripts/                # Maintenance + scraper canary
├── drizzle/                # SQL migrations
├── env.ts                  # Validated env vars (T3 + Zod)
└── nuxt.config.ts
```

---

## Pages

| Route              | File                        | Purpose                                       |
| ------------------ | --------------------------- | --------------------------------------------- |
| `/`                | `pages/index.vue`           | Landing: featured flats, map preview, JSON-LD |
| `/overview`        | `pages/overview.vue`        | Paginated filterable listing table            |
| `/map`             | `pages/map.vue`             | Google Maps with markers + filters            |
| `/about`           | `pages/about.vue`           | Project info, PM stats, activity chart        |
| `/privacy`         | `pages/privacy.vue`         | Datenschutzerklärung, Maps consent            |
| `/login`           | `pages/login.vue`           | Admin login (Better Auth)                     |
| `/admin/dashboard` | `pages/admin/dashboard.vue` | Scraper control panel (protected)             |

---

## Data Flow

```
Scheduled tasks / admin trigger
         │
         ▼
syncListingsForPropertyManagement(slug)     server/lib/scraper/sync-listings.ts
  ├── PM.extractUrls()                      data/propertyManagements/*.ts
  ├── Soft-delete flats no longer listed
  ├── Update lastSeen on existing flats
  └── Enqueue new URLs → flatUrlJob (pending)
         │
         ▼
processFlatUrlJobs()                        server/lib/scraper/process-flat-url-jobs.ts
  ├── fetchHtml(url)                        lib/http.ts
  ├── PM.extractDataFromHtml()              node-html-parser / JSON
  ├── getImage() → sharp 200×200            lib/flat-utils.ts
  ├── shouldIgnoreListing()                 lib/flat-utils.ts
  └── UPSERT flat ON CONFLICT(url)
         │
         ▼
address-improvement task                    server/tasks/address-improvement.ts
  ├── getAddressFromPhoton()                lib/photon.ts
  └── INSERT address; SET flat.addressId
         │
         ▼
Display via tRPC
  ├── flat.getAll / getFeatured             server/trpc/routers/flat.ts
  ├── /api/image/:flatId                    server/api/image/[flatId].ts
  └── pages: overview, map, index
```

**Public visibility rules** (applied in `flat` router queries):

- `deleted` is null
- `addressId` is set (geocoded)
- `ignored` is false

**Tags:** Derived at read time via `getDisplayTags(title, isNew)` in `server/trpc/routers/flat.ts` (`data/tags.ts`). Not persisted. Legacy `tag` / `flatToTag` tables still in schema but unused — see `docs/cleanup-backlog.md`.

---

## Database

**ORM:** Drizzle on SQLite via Bun. Client: `server/db/client.ts`. Path: `LOCAL_SQLITE_PATH` env var.

### Core tables (`server/db/schema.ts`)

| Table                | Role                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `flat`               | Central listing — rent, rooms, area, image blob, url (unique), addressId, PM slug, firstSeen/lastSeen, deleted, ignored |
| `flatUrlJob`         | Scrape queue — url PK, status (pending/completed/failed), attempts, lastError                                           |
| `scraperRun`         | Audit log for scraper runs                                                                                              |
| `address`            | Geocoded address — street, postalCode, lat/lng; id is hash                                                              |
| `propertyManagement` | Housing company registry — slug PK, name, website, active                                                               |
| `tag` / `flatToTag`  | **Legacy, unused** — pending drop (see `docs/cleanup-backlog.md`)                                                       |
| `signups`            | Mailing list (legacy stub)                                                                                              |

### Auth tables (`server/db/auth-schema.ts`)

`user`, `session`, `account`, `verification` — managed by Better Auth.

### Relationships

```
propertyManagement (slug)
  └── 1:N flat
        └── N:1 address
```

Migrations in `drizzle/` (0000–0007). Auto-applied on server start via `server/plugins/migrate.ts`.

---

## tRPC API

**Handler:** `server/api/trpc/[trpc].ts`  
**Client:** `plugins/client.ts` → `useNuxtApp().$client`

### `flat` (public)

| Procedure           | Purpose                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `getFeatured`       | Recent flats with tags, `hasImage`, `isNew`                                                                     |
| `getAll`            | Paginated/filtered listings — input: `flatFilterUrlSchema` from `composables/useUrlState.ts`                    |
| `getMapPreviewHash` | Hash of active flat IDs (cache busting for map preview; **does not** require `addressId` — see cleanup backlog) |

### `propertyManagement`

| Procedure            | Auth      | Purpose                                                   |
| -------------------- | --------- | --------------------------------------------------------- |
| `getAll`             | public    | Active PMs with flat counts                               |
| `getScraperOverview` | protected | Job queue stats, recent runs                              |
| `update`             | protected | Trigger scrape: `mode: full \| sync_only \| extract_only` |
| `retryFlatUrlJob`    | protected | Re-queue failed job by URL                                |

### `stats` (public)

| Procedure          | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `getActivityStats` | Histograms of `firstSeen` by day/hour/week |

### `mailingList` (public stub)

`signUp` validates but returns random flats (not persisted). `get` returns all signups.

### Procedures (`server/trpc/trpc.ts`)

- `publicProcedure` — no auth
- `protectedProcedure` — requires `ctx.user` from session

---

## REST API Routes

| Path                     | File                                                    |
| ------------------------ | ------------------------------------------------------- |
| `/api/trpc/*`            | `server/api/trpc/[trpc].ts`                             |
| `/api/auth/*`            | `server/api/auth/[...all].ts`                           |
| `/api/image/:flatId`     | `server/api/image/[flatId].ts` — JPEG from DB blob      |
| `/api/image/map-preview` | `server/api/image/map-preview.ts`                       |
| `POST /stats/collect`    | `server/routes/stats/collect.post.ts` — analytics proxy |

---

## Scraper Architecture

### Property management interface (`data/schemas.ts`)

```typescript
type PropertyManagement = {
  slug: string;
  name: string;
  website?: string;
  extractUrls: () => Promise<string[]>;
  extractDataFromHtml: (html: string, href: string) => ScrapedFlat;
  getFetchOptions?: () => KyOptions; // e.g. gewobag session cookies
  shouldIgnoreListing?: (flat: FlatForProviderIgnoreCheck) => boolean;
};
```

`ScrapedFlat` has nullable `roomCount` / `usableArea` — failed extraction persists `null`, not `0`.

### Active scrapers (`data/propertyManagements/`)

| Slug           | File              | URL discovery                |
| -------------- | ----------------- | ---------------------------- |
| `berlinovo`    | `berlinovo.ts`    | HTML listing pages           |
| `degewo`       | `degewo.ts`       | POST paginated `/immosuche`  |
| `gewobag`      | `gewobag.ts`      | HTML listing page            |
| `howoge`       | `howoge.ts`       | JSON API `immoList`          |
| `stadtundland` | `stadtundland.ts` | CloudFront JSON API          |
| `deuwo`        | `deuwo.ts`        | Shared `deuvono.ts` JSON API |
| `vonovia`      | `vonovia.ts`      | Shared `deuvono.ts` JSON API |

**Registry:** `data/propertyManagements/index.ts`  
**Metadata:** `data/propertyManagements/configs.ts`  
**Shared Deuvono logic:** `data/propertyManagements/shared/deuvono.ts`  
**Shape contract:** `data/propertyManagements/shape-contract.ts` — `assertFlatShape` / `assertScrapedFlatSchema`  
**Fixtures:** `data/fixtures/*.html` + `data/fixtures/expected.ts` — exercised by `scrapers.test.ts`

### Server scraper lib (`server/lib/scraper/`)

| File                       | Role                                                 |
| -------------------------- | ---------------------------------------------------- |
| `sync-listings.ts`         | Fetch URLs, soft-delete removed, enqueue new jobs    |
| `process-flat-url-jobs.ts` | Fetch HTML, parse, upsert flat, mark job done/failed |
| `prune-stale-flats.ts`     | Soft-delete flats not seen for 7 days                |
| `log-scraper-run.ts`       | Insert scraperRun audit row                          |

### Ignore rules (`lib/flat-utils.ts` → `shouldIgnoreListing`)

1. Optional per-provider `shouldIgnoreListing` on `PropertyManagement` (deuwo/vonovia: `shouldIgnoreDeuvonoListing` in `shared/deuvono.ts` — zero-room and ≤100€)
2. Global parking/commercial title keywords in `flat-utils.ts`

Matching listings → `flat.ignored = true`.

---

## Scheduled Tasks

Configured in `nuxt.config.ts` → `nitro.scheduledTasks`:

| Cron           | Task                  | Behavior                                         |
| -------------- | --------------------- | ------------------------------------------------ |
| `* * * * *`    | `update-flats`        | Prune 7d stale; sync **one** PM (round-robin)    |
| `* * * * *`    | `extract-flats`       | Process **10** pending jobs (1–6s sleep between) |
| `* * * * *`    | `address-improvement` | Geocode **10** flats via Photon                  |
| `*/15 * * * *` | `update-map-preview`  | Regenerate map PNG if flat set changed           |

Task files: `server/tasks/*.ts`

---

## Composables

| File                           | Role                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| `useUrlState.ts`               | Sync filters/pagination to URL query; exports `flatFilterUrlSchema` |
| `useMapFlats.ts`               | Map data, marker selection, `?flat=` deep link                      |
| `useFavorites.ts`              | localStorage favorites → `flat.getAll({ ids })`                     |
| `useLocalStorage.ts`           | Zod-validated localStorage wrapper                                  |
| `useConsent.ts`                | GDPR consent for Google Maps                                        |
| `useCustomLoadingIndicator.ts` | Global loading from registered query refs                           |

---

## Key Components

| Area     | Files                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| Layout   | `PageHeader.vue`, `PageFooter.vue`, `HamburgerMenu.vue`, `LoadingIndicator.vue`  |
| Listings | `Apartment/Preview.vue`, `MobileListingCard.vue`, `Details.vue`, `FlatImage.vue` |
| Map      | `Map/FlatMarker.vue`, `FlatPreview.vue`, `FlatPreviewContent.vue`                |
| Filters  | `Filters.vue`, `Pagination.vue`, `Modal.vue`, `Slider.vue`                       |
| Charts   | `FlatActivityChart.vue` (about page)                                             |

---

## Auth

| Piece        | Location                                                      |
| ------------ | ------------------------------------------------------------- |
| Server       | `lib/auth.ts` — Better Auth + Drizzle; `disableSignUp: true`  |
| Client       | `lib/auth-client.ts`                                          |
| API          | `server/api/auth/[...all].ts`                                 |
| Route guard  | `middleware/admin.global.ts` — `/admin/*` → `/login`          |
| tRPC context | `server/trpc/context.ts` — `auth.api.getSession` → `ctx.user` |
| Seed admin   | `bun seed:admin` → `scripts/seed-admin-auth.ts`               |

---

## Environment Variables

Validated in `env.ts` via `@t3-oss/env-nuxt`:

| Variable                          | Scope  | Purpose                                         |
| --------------------------------- | ------ | ----------------------------------------------- |
| `LOCAL_SQLITE_PATH`               | server | SQLite file path                                |
| `BETTER_AUTH_SECRET`              | server | Auth signing (≥32 chars)                        |
| `GOOGLE_MAPS_API_KEY`             | server | Static map generation                           |
| `DEPLOYMENT_URL`                  | server | Canonical URL (default `http://localhost:3000`) |
| `ADMIN_SCRAPER_EXTRACT_BATCH`     | server | Admin extract batch size (default 40, max 500)  |
| `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | client | Interactive map                                 |
| `NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | client | Map styling ID                                  |
| `ENV_FILE_PATH`                   | —      | Alternate dotenv path                           |

Seed script extras: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`

---

## Commands

```bash
bun dev              # Dev server
bun build            # Production build
bun typecheck        # Type check
bun test             # scrapers, flat-utils, tags, deuvono
bun scrape:canary    # Live extraction drift check (exit 1 on failure)
bun db:generate      # Generate Drizzle migrations
bun db:migrate       # Run migrations
bun db:push          # Push schema directly (dev)
bun db:studio        # Drizzle Studio
bun seed:admin       # Create admin user
```

---

## Maintenance Scripts

| Script                                       | Purpose                                           |
| -------------------------------------------- | ------------------------------------------------- |
| `scripts/scraper-canary.ts`                  | Live scraper drift check (`bun scrape:canary`)    |
| `scripts/seed-admin-auth.ts`                 | Create admin user                                 |
| `scripts/dedupe-flats-by-url.ts`             | Dedupe flat rows by URL (`--dry-run`)             |
| `scripts/mark-non-residential-as-ignored.ts` | Backfill `ignored=true` via `shouldIgnoreListing` |

---

## Server Plugins (startup)

1. `server/plugins/migrate.ts` — dedupe flats, run Drizzle migrations
2. `server/plugins/seed-property-managements.ts` — upsert PM rows from code registry

---

## Key Shared Libraries

| File                    | Role                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `lib/flat-utils.ts`     | `shouldIgnoreListing`, `getPropertyManagement`, `getImage` (sharp) |
| `lib/http.ts`           | `fetchHtml`, `fetchJson` via ky                                    |
| `lib/parser.ts`         | German number parsing, address/text helpers                        |
| `lib/photon.ts`         | Geocode via photon.komoot.io                                       |
| `lib/utils.ts`          | `processWithQueue`, `omit`, `pick`                                 |
| `utils/util.ts`         | `formatPrice`, `formatArea`, `formatRoomCount`                     |
| `utils/flat.ts`         | `getProviderName`, `hasMapCoordinates`, `getFlatImageUrl`          |
| `types/listing-flat.ts` | `ListingFlat` inferred from tRPC                                   |

---

## Tests

| File                                              | Covers                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| `data/propertyManagements/scrapers.test.ts`       | Fixture parsing + expected field values             |
| `data/propertyManagements/shared/deuvono.test.ts` | Deuvono ignore rules                                |
| `data/propertyManagements/shape-contract.ts`      | Shared extraction contract (used by tests + canary) |
| `data/tags.test.ts`                               | Title → tag keyword mapping                         |
| `lib/flat-utils.test.ts`                          | `shouldIgnoreListing` parking/commercial rules      |

Room/area filters in `flat.getAll` use `isNotNull` — flats with unknown `roomCount` or `usableArea` are excluded when those filters are set.

---

## Code Conventions

- **Runtime:** Bun (not npm/yarn)
- **Indent:** 2 spaces, double quotes, semicolons
- **Types:** `type` over `interface`; inline type imports (`import { type Foo }`)
- **Validation:** Zod only; Drizzle schema = DB source of truth
- **Vue:** `<script setup lang="ts">`; components PascalCase; composables `use*` prefix
- **Imports:** `~/` for project root
- **Auto-imports:** components, composables, utils

Further tracked cleanups: `docs/cleanup-backlog.md`. Telegram/pipeline roadmap: `docs/listing-pipeline-design.md`.
