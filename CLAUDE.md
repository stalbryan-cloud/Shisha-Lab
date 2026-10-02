# CLAUDE.md — SHISHA LAB

Community web app for documenting and discussing homemade shisha tobacco recipes. Next.js 15 App Router · React 19 · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage, RLS).

## Non-negotiable rules
1. **Always maintain RLS.** Every table has RLS enabled. New tables ship with policies and a test in `supabase/tests/`. Authorization lives in the database; UI hiding is cosmetic only.
2. **Never expose service-role credentials.** `SUPABASE_SERVICE_ROLE_KEY` is used only in `src/lib/supabase/admin.ts` (server-only), by the cron route and `deleteAccount`. Never prefix it `NEXT_PUBLIC_`, never import it in a client component.
3. **Do not introduce tobacco commerce.** No shop, checkout, marketplace, user-to-user sales, affiliate links, vendor buy buttons, price comparison or purchase-oriented links. No price/URL fields on tobaccos, aromas or brands. Recipe sources are citations only.
4. **Preserve recipe version history.** `recipe_versions.snapshot` is immutable. Publishing goes only through `publish_recipe()`. Never edit or delete old versions.
5. **Never change the schema without a migration.** Add a new `supabase/migrations/NNNN_*.sql`; never edit an applied one.
6. **Run typecheck and tests after meaningful changes:** `npm run typecheck && npm test && npm run test:db`; run `npm run test:e2e` for UI/flow changes.
7. Community recipes are user-generated experiences, not safety or medical guarantees. Badges describe platform evidence only and must never claim "safe" or "verified".

## Layout
- `supabase/migrations/` schema, RLS, functions · `supabase/tests/` SQL tests (`npm run test:db`) · `supabase/seed.sql` demo data
- `src/lib/core/` pure logic (scaler, ratings, markdown, filters, badges, completeness) — tests are `node:test` (`npm run test:core`)
- `src/lib/actions/` Server Actions (return `ActionResult`; use `authed()`; validate with zod in `src/lib/validators/`)
- `src/lib/queries/` server-side reads · `src/lib/supabase/` clients · `src/components/` UI · `src/app/` routes
- `tests/unit` Vitest · `tests/e2e` Playwright

## Conventions
- Per-request Supabase client with the user's JWT, so RLS always applies. Use RPCs for anything privileged and re-check roles inside the function.
- Mass↔volume is never converted without an explicit density (see `scaler.ts`).
- Design tokens are CSS variables in `globals.css`; use the `.btn/.field/.card/.chip` classes.
- See `docs/DEVELOPMENT.md` for formulas (trending, rating), badge rules and known limitations.
