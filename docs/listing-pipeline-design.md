# Listing Pipeline Design

_Draft for validation · 2026-07-15_

This document captures architectural reasoning from a design discussion about:

1. Whether to split frontend and backend for Telegram integration
2. How to hook into “new flats” for notifications
3. How to improve the end-to-end flow of listings through the system

It is written for another agent (or human) to **validate, challenge, or implement**. It cross-references [AGENT-OVERVIEW.md](./AGENT-OVERVIEW.md) for current code layout.

**Vocabulary** follows the deep-module design language: **module**, **interface**, **implementation**, **depth**, **seam**, **adapter**, **leverage**, **locality**. See [codebase-design skill](https://github.com/) vocabulary in project skills.

---

## Executive summary

| Question                                                  | Recommendation                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Split Nuxt into separate frontend + backend for Telegram? | **No** — Telegram is a server-side consumer of existing data; splitting adds cost without solving the real problem       |
| How to hook “new flat” notifications?                     | Hook at **`became-publishable`** transition, not at DB insert                                                            |
| How to improve flat flow?                                 | Introduce a **`listing-pipeline` module** with explicit stages and typed transitions; fold 3 cron tasks into one runner  |
| Relationship to scraper/test work already landed?         | Scraper fixtures, shape contract, and nullable rooms/area are done; implement transition model next, then scraper purity |

---

## Part 1 · Context and constraints

### Product

**WohnungsMarktBerlin** — aggregates Berlin rental listings scraped from public housing companies (Hausverwaltungen). Stack: Nuxt 4 full-stack, Bun, SQLite + Drizzle, tRPC, Nitro scheduled tasks.

### Planned feature driver

**Telegram bot integration** — notify users when new listings matching their filters appear. A working reference exists in sibling project `../wohnungssuche` (Grammy, message formatting, rate limiting), but that bot scrapes its own data. This project should **read from the shared SQLite DB**, not duplicate scrapers.

### What triggered this design work

- “New flat” has **no single definition** in the codebase today
- Notification hook points are **implicit** (would require polling or ad-hoc hooks in multiple files)
- Four independent cron tasks **poll DB state** rather than driving an explicit lifecycle
- Scraper/classification seams (tags at read-time, provider ignore hooks) are partly done; unified `classify-listing` is still open

---

## Part 2 · Decision: do not split frontend and backend

### Current architecture

Nuxt 4 is a **full-stack monolith**:

| Layer             | Location                                | Role                                            |
| ----------------- | --------------------------------------- | ----------------------------------------------- |
| Frontend          | `pages/`, `components/`, `composables/` | Vue UI, map, filters                            |
| API               | `server/trpc/`, `server/api/`           | tRPC + REST (images, auth)                      |
| Workers           | `server/tasks/`                         | Nitro cron: sync, extract, geocode, map preview |
| Domain + scrapers | `data/propertyManagements/`, `lib/`     | Scraper configs, HTTP, parsing helpers          |
| DB                | `server/db/`                            | SQLite via Drizzle                              |

tRPC provides **end-to-end type inference** (`types/listing-flat.ts` infers from `AppRouter`). The tRPC client uses a relative `/api/trpc` URL (`plugins/client.ts`).

### Why splitting was considered

Telegram bot feels like “another app” — long-running process, webhooks/polling, push notifications. Natural to picture a separate backend service.

### Why splitting is premature

| What you have                         | What splitting costs                                    |
| ------------------------------------- | ------------------------------------------------------- |
| Nitro server already _is_ the backend | Lose tRPC type inference or need shared package/codegen |
| Scrapers + cron co-located with DB    | Two deploys, CORS, cross-origin auth                    |
| ~120 TS/Vue files, single product     | Operational overhead >> benefit                         |
| One `bun dev` workflow                | Worker service still needed anyway                      |

### Correct framing

Telegram is a **new server-side consumer** of the listing pipeline output, not a reason to decouple Vue from Nitro.

### When splitting _would_ make sense

- Frontend deployed as static/SSR-only CDN asset, API on separate host
- Multiple teams owning web vs workers
- Third client (mobile app) forces a stable public API boundary
- Bot + scrapers must scale independently from web traffic

### Recommended interim shape (if separation is desired later)

**Logical monorepo**, not repo split:

```
packages/
  core/     # db, scrapers, pipeline, schemas
  web/      # Nuxt frontend
  bot/      # Grammy thin layer → core
```

Extract `core` only when boundaries hurt — not as prerequisite for Telegram.

---

## Part 3 · Problem analysis: “new flat” is not one event

### Current lifecycle (implicit)

```
sync-listings              process-flat-url-jobs         address-improvement
      │                            │                            │
      ▼                            ▼                            ▼
flatUrlJob (pending)         flat row upserted            addressId set
"new URL"                    firstSeen = now              flat becomes visible
```

### Multiple meanings of “new”

| Stage          | File                                          | Meaning                                         |
| -------------- | --------------------------------------------- | ----------------------------------------------- |
| URL discovered | `server/lib/scraper/sync-listings.ts`         | URL not in active flats                         |
| Row created    | `server/lib/scraper/process-flat-url-jobs.ts` | `firstSeen` set on upsert                       |
| User-visible   | `server/trpc/routers/flat.ts`                 | `addressId` set + `!ignored` + `!deleted`       |
| UI badge       | `server/trpc/routers/flat.ts`                 | `firstSeen` within 12 hours (`countsAsNewTime`) |

**Telegram and user notifications care about “user-visible” (publishable), not URL discovery or raw insert.**

### Visibility rules are scattered and inconsistent

**Canonical public query** (`flat.ts` `queryOptions`):

```typescript
where: and(
  isNull(flat.deleted),
  isNotNull(flat.addressId),
  eq(flat.ignored, false),
);
```

**`getMapPreviewHash`** omits `addressId`:

```typescript
.where(and(isNull(flat.deleted), eq(flat.ignored, false)))
```

This is a latent bug / inconsistency a validator should confirm.

### Disconnected notification stub

- `server/trpc/routers/mailingList.ts` — `signUp` returns random flats, does not persist
- `signups` table exists in schema with filter fields (`districts`, `maxPrice`, `minRooms`)
- No code emits events when listings become visible

### Filter logic in wrong seam for reuse

- `flatFilterUrlSchema` defined in `composables/useUrlState.ts` (client composable)
- Server tRPC router imports it for `flat.getAll`
- Telegram bot would need the same filter semantics without HTTP — composable is the wrong home

---

## Part 4 · First improvement: publishability seam

### Core insight

Do not hook at “flat inserted.” Hook at **“flat became publishable”** — the first moment a listing satisfies visibility rules.

### Shallow pattern (reject)

```
process-flat-url-jobs → telegram.send()
address-improvement   → telegram.send()
cron task             → SELECT WHERE firstSeen > last_check
mailingList.signUp    → poll DB
```

**Deletion test fails:** complexity reappears in every consumer; visibility rules duplicated; race-prone polling.

### Deep module: `flat-publishability`

**Interface:**

```typescript
type PublishableFlat = {
  id: string;
  title: string;
  url: string;
  coldRentPrice: number | null;
  warmRentPrice: number | null;
  roomCount: number | null;
  usableArea: number | null;
  propertyManagementId: string | null;
  address: {
    street: string;
    streetNumber: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
  // extend as needed for notify + filter matching
};

type PublishabilityChange =
  | { kind: "became-publishable"; flat: PublishableFlat }
  | {
      kind: "became-unpublishable";
      flatId: string;
      reason: "deleted" | "ignored" | "delisted";
    };

function isPublishable(flat: FlatRow): boolean;

function reconcilePublishability(
  before: FlatRow,
  after: FlatRow,
): PublishabilityChange | null;
```

**Call sites (initial):**

1. `process-flat-url-jobs.ts` — after upsert (handles re-listed flat with existing `addressId`)
2. `address-improvement.ts` — after `addressId` set (primary path for new listings)
3. `sync-listings.ts` / `prune-stale-flats.ts` — soft-delete → `became-unpublishable`

### Notification dispatch (second seam)

```typescript
type FlatNotifier = (change: PublishabilityChange) => Promise<void>;

async function dispatchPublishabilityChange(
  change: PublishabilityChange,
  notifiers: FlatNotifier[],
): Promise<void>;
```

Wiring in `server/plugins/flat-notifiers.ts`:

```typescript
const notifiers: FlatNotifier[] = [telegramNotifier /*, email later */];
```

Telegram is **one adapter**. Email/push added without touching scrapers.

### Filter module (parallel extraction)

Move filter schema out of composable:

```
lib/flat-filters.ts
  flatFilterSchema        # normalized domain shape (not URL array format)
  matchesFilter(flat, filter): boolean     # for Telegram per-subscriber matching
  flatFilterToSql(filter): SQL[]           # for tRPC router
```

`composables/useUrlState.ts` becomes thin URL ↔ `FlatFilter` adapter.

---

## Part 5 · Second improvement: explicit listing pipeline

Publishability fixes **one transition**. The broader problem is that flow is **time-shaped** (cron polls) not **intent-shaped** (explicit stages).

### Current scheduling

From `nuxt.config.ts`:

| Cron           | Task                  | Behavior                                      |
| -------------- | --------------------- | --------------------------------------------- |
| `* * * * *`    | `update-flats`        | Prune 7d stale; sync **one** PM (round-robin) |
| `* * * * *`    | `extract-flats`       | Process **10** pending jobs                   |
| `* * * * *`    | `address-improvement` | Geocode **10** flats                          |
| `*/15 * * * *` | `update-map-preview`  | Regenerate map PNG                            |

Tasks are independent. A new listing typically needs **two cron ticks** minimum (extract, then geocode) before publishable — up to ~2 minutes latency.

### Proposed: derived stage model

No DB migration initially — derive stage from existing columns:

```typescript
type ListingStage =
  | "discovered" // flatUrlJob pending (URL known, no flat row yet)
  | "extracted" // flat row exists, not enriched (no addressId)
  | "enriched" // addressId set (may still be ignored)
  | "publishable" // passes visibility rules
  | "withdrawn"; // soft-deleted or delisted

function deriveStage(flat: FlatRow | null, job?: FlatUrlJobRow): ListingStage;
```

Add explicit `listing_stage` column **only if** derivation becomes painful or slow.

### Proposed: typed transitions (full seam)

```typescript
type ListingTransition =
  | { kind: "discovered"; url: string; pmId: string }
  | { kind: "extracted"; flatId: string; created: boolean }
  | { kind: "enriched"; flatId: string }
  | { kind: "became-publishable"; flat: PublishableFlat }
  | {
      kind: "became-unpublishable";
      flatId: string;
      reason: "deleted" | "ignored" | "delisted";
    }
  | { kind: "metadata-updated"; flatId: string }; // re-scrape refresh, no notify
```

`reconcilePublishability` is a **subset** of `reconcileTransitions(before, after)`.

**Withdrawal symmetry:** `sync-listings` soft-delete and `prune-stale-flats` must emit `became-unpublishable`, not silently mutate.

### Proposed module layout

```
server/lib/listing-pipeline/
  types.ts            # ListingSnapshot, PipelineLimits, PipelineResult
  stages.ts           # deriveStage, isPublishable
  transitions.ts      # reconcileTransitions
  discover.ts         # logic from sync-listings.ts
  extract.ts          # fetch + parse + classify + persist
  enrich.ts           # geocode via photon adapter
  run.ts              # deep interface — runPipeline()
  dispatch.ts         # fan-out transitions to notifiers

lib/
  classify-listing.ts # { ignore, tags } — unified classification (still open)
  flat-filters.ts     # shared filter matching
  flat-publishability.ts  # or merged into stages.ts
```

### Deep interface

```typescript
type PipelineLimits = {
  discover: number; // PMs to sync per tick (today: 1)
  extract: number; // jobs per tick (today: 10)
  enrich: number; // geocode per tick (today: 10)
};

type PipelineResult = {
  transitions: ListingTransition[];
  errors: Array<{ stage: ListingStage; ref: string; message: string }>;
  stats: {/* per-stage counts */};
};

async function runPipeline(ctx: {
  db: Db;
  limits: PipelineLimits;
  notifiers?: TransitionNotifier[];
}): Promise<PipelineResult>;
```

**Cron consolidation:**

```typescript
// server/tasks/listing-pipeline.ts — replaces update-flats, extract-flats, address-improvement
export default defineTask({
  meta: { name: "listing-pipeline", description: "..." },
  run: async () => {
    const result = await runPipeline({ db, limits: { discover: 1, extract: 10, enrich: 10 } });
    await logScraperRun({ kind: "listing-pipeline", stats: result.stats, ... });
    return { result };
  },
});
```

`update-map-preview` stays separate initially (derived artifact). Optionally subscribe to `became-publishable` batch for cache busting.

### Inline enrichment (latency win)

Inside `extract.ts`, after persist, if flat still needs geocode and enrich budget remains:

```typescript
await enrichListing(flatId); // same tick
```

New listing can reach publishable in **one pipeline tick** instead of waiting for next cron. Cron still drains backlog when enrich budget exhausted.

### Write-path unification

Target persist seam:

```
parseFlat(html, href)              pure (optional refactor)
       ↓
classifyListing(parsed, pm)        { ignore, tags } — candidates 3–4
       ↓
persistListing(classified)           flat row + flatToTag + Transition[]
       ↓
enrichListing(flatId)              address + Transition[]
       ↓
dispatch(transitions)              telegram, logs, map bust
```

**Tags (decided):** Option A — `tags` removed from scraper contract; derive at read-time. Drop legacy `tag` / `flatToTag` tables when convenient.

**Classification (candidates 3–4):** merge `data/tags.ts` title keywords and `lib/flat-utils.ts` parking/commercial ignore rules into `classifyListing`. Optional `PropertyManagement.ignore(flat)` hook for Deuvono quirks instead of slug checks in `flat-utils`.

**Orchestration testability (candidate 5):** accept `db` as parameter; extract `flatRowFromScraped()` mapper so insert/update cannot drift.

---

## Part 6 · Telegram integration (consumer of pipeline)

### Not in scope of pipeline core

Telegram-specific code is an **adapter**, not part of the pipeline interface:

```
server/lib/notifiers/
  telegram.ts       # Grammy, renderFlat (port from wohnungssuche)
  types.ts
```

### Schema addition (expected)

```typescript
telegramSubscription = sqliteTable("telegramSubscription", {
  chatId: text("chatId").primaryKey(),
  filterJson: text("filterJson", { mode: "json" }), // FlatFilter shape
  createdAt: integer("createdAt", { mode: "timestamp" }),
});
```

`telegramNotifier` on `became-publishable`:

1. Load active subscriptions
2. `matchesFilter(flat, subscription.filter)`
3. Rate-limited send (1 msg/sec — from wohnungssuche pattern)
4. Dedup via `telegramSentFlat` join table or outbox

### Webhook vs polling

| Mode                               | Pros                | Cons                                         |
| ---------------------------------- | ------------------- | -------------------------------------------- |
| Webhook at `/api/telegram/webhook` | No separate process | Needs public HTTPS                           |
| Long-poll `bun server/bot/poll.ts` | Simple local dev    | Separate process, shares `LOCAL_SQLITE_PATH` |

Both work in monolith. Validator should check deployment constraints (`DEPLOYMENT_URL`).

### Reference implementation

`../wohnungssuche/src/index.ts` — Grammy, `renderFlat`, inline keyboard, rate limiting. **Do not copy scraping logic** — only message formatting and bot UX.

---

## Part 7 · Alternatives considered

### A · Event bus with many event types

```typescript
bus.emit("flat.extracted", ...)
bus.emit("flat.geocoded", ...)
// ...
```

**Rejected as primary seam:** shallow — callers must learn many events. Typed `ListingTransition` union keeps surface small.

### B · Outbox table for durability

```sql
flat_outbox (id, flatId, event, createdAt, processedAt)
```

**Deferred:** justified when Telegram retry/delivery guarantees matter. Start with in-process `dispatch()`. Promote to outbox when failures observed.

### C · Explicit `listing_stage` column

**Deferred:** derive from existing columns first. Migration adds complexity and sync burden between column and derived rules.

### D · Generic `work_queue` replacing `flatUrlJob`

**Deferred:** one queue kind works today (`extract`). Generalize when enrich needs independent retry semantics at scale.

### E · Full frontend/backend split

**Rejected for now** — see Part 2.

---

## Part 8 · Module dependency diagram

```
┌─────────────────────────────────────────────────────────────┐
│  data/propertyManagements/*.ts                              │
│  parseFlat / parseListUrls (pure, optional)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ ScrapedFlat
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  lib/classify-listing.ts                                    │
│  classifyListing → { ignore, tags }                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  server/lib/listing-pipeline/                               │
│  discover → extract → enrich → reconcileTransitions         │
└──────────────────────────┬──────────────────────────────────┘
                           │ ListingTransition[]
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  server/lib/listing-pipeline/dispatch.ts                    │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐   ┌───────────────────────────────┐
│ notifiers/telegram.ts │   │ update-map-preview (optional) │
└───────────────────────┘   └───────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  lib/flat-filters.ts                                        │
│  matchesFilter / flatFilterToSql                            │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐   ┌───────────────────────────────┐
│ composables (URL)     │   │ server/trpc/routers/flat.ts   │
└───────────────────────┘   └───────────────────────────────┘
```

---

## Part 9 · Implementation phases

Ordered for incremental delivery. Each phase has verifiable success criteria.

### Phase 0 · Document and validate (this doc)

- [x] Another agent reviews assumptions against live code (2026-07-15)
- [ ] Confirm `getMapPreviewHash` addressId inconsistency — tracked in `cleanup-backlog.md`
- [x] Tags Option A — derive at read time; drop legacy `tag` / `flatToTag` tables (migration pending)

### Phase 1 · Transitions without moving files

**Goal:** Correct hook seam, no big refactor.

1. Add `lib/flat-publishability.ts` — `isPublishable`, `reconcilePublishability`
2. Unit tests: matrix of before/after states (ignored, no address, deleted, re-list with address)
3. Call `reconcilePublishability` from `process-flat-url-jobs.ts` and `address-improvement.ts`
4. Log transitions (no Telegram yet)

**Verify:** inserting test flat + geocoding logs `became-publishable` exactly once.

### Phase 2 · Filters extraction

1. Add `lib/flat-filters.ts` with normalized `FlatFilter` schema
2. Refactor `flat.ts` router to use `flatFilterToSql`
3. Refactor `useUrlState.ts` to parse URL → `FlatFilter`

**Verify:** `bun typecheck` passes; overview/map behavior unchanged.

### Phase 3 · Classification unification

1. Add `lib/classify-listing.ts`
2. Replace `shouldIgnoreListing` + read-time tag keyword lists with one vocabulary
3. Tags stay read-time (Option A); no `flatToTag` writes

**Verify:** `bun test`; existing `lib/flat-utils.test.ts` cases migrated.

### Phase 4 · Pipeline module

1. Create `server/lib/listing-pipeline/` with `runPipeline`
2. Move logic from `sync-listings`, `process-flat-url-jobs`, `address-improvement` into `discover`/`extract`/`enrich`
3. Replace 3 cron tasks with `listing-pipeline` task
4. Add inline enrich after extract when budget allows

**Verify:** `scraperRun` logs show pipeline stats; publishable latency decreases for new listings.

### Phase 5 · Telegram adapter

1. `telegramSubscription` schema + migration
2. `server/lib/notifiers/telegram.ts`
3. Wire into `dispatch` on `became-publishable`
4. Port `renderFlat` from wohnungssuche

**Verify:** test subscription receives message when matching flat geocoded.

### Phase 6 · Scraper purity (optional)

Can run **in parallel** with Phase 3–4. Fixture tests and shape contract already landed.

1. Split scrapers into `parseListUrls` / `parseFlat` (pure)
2. Single HTTP runner via `lib/http`
3. Extend fixture coverage as new page types appear

**Verify:** degewo stops using raw `fetch`; canary stays green.

---

## Part 10 · Test matrix for validators

### `deriveStage` / `isPublishable`

| deleted | ignored | addressId | addressImprovement | job.status | Expected stage                              |
| ------- | ------- | --------- | ------------------ | ---------- | ------------------------------------------- |
| null    | false   | null      | pending            | —          | extracted                                   |
| null    | false   | set       | success            | —          | enriched or publishable\*                   |
| null    | false   | set       | success            | —          | publishable if enriched + !ignored          |
| set     | false   | set       | success            | —          | withdrawn                                   |
| null    | true    | set       | success            | —          | withdrawn (or enriched but not publishable) |

\* `enriched` vs `publishable`: if `isPublishable` requires address + !ignored + !deleted, enriched with ignore=true is not publishable.

### `reconcileTransitions`

| Before          | After                  | Expected transition                           |
| --------------- | ---------------------- | --------------------------------------------- |
| (no row)        | new flat, no addressId | `extracted` created=true                      |
| no addressId    | addressId set          | `enriched` then possibly `became-publishable` |
| publishable     | deleted set            | `became-unpublishable` reason=deleted         |
| publishable     | ignored=true           | `became-unpublishable` reason=ignored         |
| publishable     | price changed          | `metadata-updated` only                       |
| not publishable | same scrape refresh    | `metadata-updated` or none                    |

### Pipeline integration

- New URL → discover → extract → enrich → publishable in one `runPipeline` call (with inline enrich)
- Re-listed URL (had addressId) → publishable on extract without waiting for geocode
- Soft-delete in sync → unpublishable transition

---

## Part 11 · Open questions for validator

1. ~~**Tags Option A or B?**~~ **Decided:** Option A (read-time). Migrate away legacy tables.
2. **`getMapPreviewHash` bug?** Should it require `addressId` like `getAll`?
3. **`metadata-updated` notifications?** Should price drops notify subscribers, or only first publish?
4. **Outbox timing?** In-process dispatch sufficient for v1 Telegram?
5. **Admin trigger path:** `propertyManagement.update` tRPC mutation triggers scrape — should it call `runPipeline` directly instead of legacy functions?
6. **`signups` table vs `telegramSubscription`:** migrate mailing list schema or parallel tables?
7. **Phase ordering:** Is Phase 6 (scraper purity) blocking Phase 4 (pipeline move), or parallel-safe?

---

## Part 12 · Files touched (expected)

### New files

| File                               | Purpose                      |
| ---------------------------------- | ---------------------------- |
| `lib/flat-publishability.ts`       | Visibility rules + reconcile |
| `lib/flat-filters.ts`              | Shared filter logic          |
| `lib/classify-listing.ts`          | Unified classification       |
| `server/lib/listing-pipeline/*.ts` | Pipeline runner              |
| `server/lib/notifiers/telegram.ts` | Telegram adapter             |
| `server/tasks/listing-pipeline.ts` | Consolidated cron            |
| `lib/flat-publishability.test.ts`  | Transition tests             |

### Modified files

| File                                          | Change                                         |
| --------------------------------------------- | ---------------------------------------------- |
| `server/lib/scraper/process-flat-url-jobs.ts` | Delegate to pipeline/extract or call reconcile |
| `server/lib/scraper/sync-listings.ts`         | Delegate to pipeline/discover                  |
| `server/tasks/address-improvement.ts`         | Absorbed into pipeline                         |
| `server/trpc/routers/flat.ts`                 | Use `flat-filters`; fix map hash if agreed     |
| `composables/useUrlState.ts`                  | Import filter schema from `lib/`               |
| `data/schemas.ts`                             | Tags decision                                  |
| `nuxt.config.ts`                              | Cron task list                                 |
| `docs/AGENT-OVERVIEW.md`                      | Update data flow section after implementation  |

### Deprecated (after Phase 4)

| File                                  | Fate                         |
| ------------------------------------- | ---------------------------- |
| `server/tasks/update-flats.ts`        | Replaced by listing-pipeline |
| `server/tasks/extract-flats.ts`       | Replaced by listing-pipeline |
| `server/tasks/address-improvement.ts` | Replaced by listing-pipeline |

---

## Part 13 · Non-goals

- Splitting into separate frontend/backend repositories
- Replacing SQLite or Drizzle
- Real-time WebSocket updates
- Convex migration
- Event sourcing for all domain events
- Rewriting admin dashboard

---

## Part 14 · Success criteria (overall)

1. **Single visibility definition** — `isPublishable` used by router, map, and notifications
2. **Single notification hook** — `became-publishable` transition only
3. **Single pipeline entry** — `runPipeline` replaces 3 polling tasks
4. **Filter reuse** — Telegram and web share `flat-filters.ts`
5. **Testable transitions** — unit tests without network or Telegram
6. **No regression** — existing pages and scraper behavior preserved through phases

---

## References

| Document / path                               | Relevance                             |
| --------------------------------------------- | ------------------------------------- |
| [AGENT-OVERVIEW.md](./AGENT-OVERVIEW.md)      | Current data flow, schema, tasks      |
| [cleanup-backlog.md](./cleanup-backlog.md)    | Tracked schema/API cleanups           |
| `../wohnungssuche/src/index.ts`               | Grammy bot, renderFlat, rate limiting |
| `server/lib/scraper/process-flat-url-jobs.ts` | Current upsert seam                   |
| `server/trpc/routers/flat.ts`                 | Visibility rules, filters             |
| `composables/useUrlState.ts`                  | Filter schema location today          |

---

_Validator: please mark each open question with a decision, confirm or reject phase ordering, and note any conflicts with code not captured in this doc._
