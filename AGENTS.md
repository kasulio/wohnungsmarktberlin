# Development Guide for Hausverwaltungs-Finder

Nuxt 4 app with TypeScript, SQLite/Drizzle, tRPC, and Bun runtime.

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
