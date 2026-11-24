# Cleanup backlog

Tracked follow-ups after refactors. Not blocking day-to-day dev.

## Database: legacy tag tables

Tags are derived from listing titles at read time (`data/tags.ts`, `server/trpc/routers/flat.ts`). The old persistence path is gone.

Still present in schema (`server/db/schema.ts`) but unused:

- `tag` — tag catalog
- `flatToTag` — flat ↔ tag join

**When cleaning up:**

1. Confirm no code reads/writes these tables (grep `flatToTag`, `from(tag)`).
2. Add a Drizzle migration to drop `flatToTag` then `tag`.
3. Remove table definitions and relations from `server/db/schema.ts`.
4. Remove `Tags` type import from schema if no longer needed there.

Existing rows in those tables are stale; safe to drop once migration ships.

## `getMapPreviewHash` visibility mismatch

`flat.getAll` / `getFeatured` require `addressId` (geocoded). `getMapPreviewHash` only checks `deleted` and `ignored`, so the map preview hash can include not-yet-geocoded flats.

**When cleaning up:**

1. Align `getMapPreviewHash` with the same visibility rules as `getAll`, or document why they differ.
2. See also [listing-pipeline-design.md](./listing-pipeline-design.md) open question on this.

## Removed env vars

- `OPENAI_API_KEY` — AI tag retriever removed. Delete from local `.env` if still set.

## Scraper pipeline after the Effect rewrite

- **Per-company scrapers are still Promise functions** calling `fetchHtml`/`fetchJson`, which use the shared `liveHttp` directly. They are paced, but tests of `syncListings` fake `extractUrls` instead of the HTTP layer. Passing an `HttpClient` into `extractUrls` would make the whole sync testable offline.
- **Address improvement, geocoding and notify are outside Effect.** `AddressImprovement` wraps `runAddressImprovement()`; `lib/photon.ts` reads the global `db`.
- **Cooldown is in-memory** in the `propertyManagement.update` router, as before.
- **A run that fails with a `DbError` is not logged** in `scraperRun` (the error reaches the Nitro task or tRPC caller instead), as before.
