# Scraper Testing

Two layers: offline fixture tests for parser correctness, live canary for website compatibility.

## Fixture tests (`bun test`)

Each scraper has checked-in HTML fixtures in `data/fixtures/` with expected field values in `data/fixtures/expected.ts`. The shared test file runs every scraper against its fixtures and asserts shape + specific values.

**Adding a fixture:**

1. Drop an HTML file in `data/fixtures/` named `{slug}--{description}.html`
2. Add an entry in `data/fixtures/expected.ts` with the expected field values
3. Run `bun test data/propertyManagements/scrapers.test.ts`

## Canary (`bun run scripts/scraper-canary.ts`)

Hits live websites, extracts a few listings per scraper, validates shape. Does not produce fixtures.

On failure, the HTML is saved to `data/canary-failures/` (gitignored) so you can inspect what broke.

**Fixing a broken scraper:**

1. Run the canary — failing HTML lands in `data/canary-failures/`
2. Fix the parser
3. Move the HTML to `data/fixtures/{slug}--{description}.html`
4. Add expected values in `expected.ts`
