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
