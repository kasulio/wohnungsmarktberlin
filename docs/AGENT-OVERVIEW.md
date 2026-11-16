# Agent Overview

Map of where things live and how a listing moves through the system. Everything not here is one `ls` or `grep` away; prefer that over trusting a copy. Setup, verification and conventions: [AGENTS.md](../AGENTS.md).

## Where to Start

| Task                             | Start here                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Add/fix a scraper                | `data/propertyManagements/` → copy existing PM file                                  |
| Change listing display/filters   | `pages/overview.vue`, `components/Filters.vue`, `server/trpc/routers/flat.ts`        |
| Change map behavior              | `pages/map.vue`, `composables/useMapFlats.ts`, `components/Map/`                     |
| DB schema change                 | `server/db/schema.ts` → `bun db:generate`; migrations apply on server start          |
| Admin scraper controls           | `pages/admin/dashboard.vue`, `server/trpc/routers/propertyManagement.ts`             |
| Scheduled background work        | `server/tasks/`, cron config in `nuxt.config.ts`                                     |
| Scraper tests / live drift check | `data/propertyManagements/scrapers.test.ts`, `bun scrape:canary`                     |
| Telegram / notification pipeline | `server/lib/notifiers/`, `server/tasks/notify.ts`, `docs/listing-pipeline-design.md` |
| Auth / admin access              | `lib/auth.ts`, `middleware/admin.ts`, `scripts/seed-admin-auth.ts`                   |

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

## Scheduled Tasks

Configured in `nuxt.config.ts` → `nitro.scheduledTasks`; they run in `bun dev` too unless `SCHEDULED_TASKS=off`. Trigger one by hand in dev: `/_nitro/tasks/<name>`.

| Cron           | Task                  | Behavior                                                                                                                                                                       |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `* * * * *`    | `update-flats`        | Prune 7d stale; sync **one** PM (round-robin)                                                                                                                                  |
| `* * * * *`    | `extract-flats`       | Process **10** pending jobs (1–6s sleep between)                                                                                                                               |
| `* * * * *`    | `address-improvement` | Geocode **10** flats via Photon                                                                                                                                                |
| `* * * * *`    | `notify`              | Sweep newly publishable flats to subscribers; the same sweep also runs right after address improvement (`server/lib/address-improvement.ts`), so admin extract runs notify too |
| `*/15 * * * *` | `update-map-preview`  | Regenerate map PNG if flat set changed                                                                                                                                         |

Task files: `server/tasks/*.ts`

## Server Plugins (startup)

1. `server/plugins/migrate.ts` — dedupe flats, run Drizzle migrations
2. `server/plugins/seed-property-managements.ts` — upsert PM rows from code registry
