# SHISHA LAB

A community platform for documenting, experimenting with, reviewing and discussing **homemade shisha tobacco recipes**. Dark "flavour laboratory" UI, mobile-first.

**Not a shop.** No tobacco sales, marketplace, checkout, affiliate or purchase links — by design. Recipes are user-generated experiences, not safety or medical guarantees; the app shows a configurable age acknowledgement, responsible-use notice, jurisdiction disclaimer and health notice.

> **Status:** database layer and core logic are tested; the Next.js app, lint, Vitest and Playwright were written without being able to run them. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#verification-status-read-first).

## Features
Structured recipes (tobacco, bases, unlimited aromas with roles, steps, maturation, characteristics, sources) · safe scaler (absolute/percent, no mass↔volume without density) · 10-step wizard with autosave and drafts · versioning · ratings + "I made this" logs · threaded comments · full forum · profiles & dashboard · collections · notifications · reports, moderation queue, audit log, warnings/suspensions · admin console · FTS search with autocomplete and synonyms · SEO (metadata, sitemap, robots, JSON-LD).

## Local development
Requirements: Node ≥ 20.9, Docker + [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
cp .env.example .env.local        # fill in values below
supabase start                    # local Postgres/Auth/Storage
supabase db reset                 # applies supabase/migrations/0001–0008 (+ seed.sql if configured)
npm run dev                       # http://localhost:3000
```
`supabase status` prints the URL, anon key and service-role key for `.env.local`. For local sign-up and e2e, disable email confirmation (`[auth.email] enable_confirmations = false` in `supabase/config.toml`, or in the dashboard under Auth → Providers → Email).

### Environment variables
| Var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser-safe | Supabase client |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME` | browser-safe | canonical URLs, sitemap, OG |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | account deletion + trending cron. Never expose. |
| `CRON_SECRET` | server only | protects `/api/cron/trending` |
| `DATABASE_URL` | scripts only | `db:seed`, `test:db` |

### Migrations, seed, first admin
Migrations live in `supabase/migrations` (apply with `supabase db push` for a hosted project). Demo data (12 users, 25 recipes, 20 aromas, 8 aroma brands, 10 tobaccos, 20 flavours, 10 forum topics — all clearly marked demo): `npm run db:seed`. Never run the seed in production. Make yourself admin:
```sql
update user_roles set role = 'admin' where user_id = '<your auth user id>';
```

### Storage buckets
Created by migration 0003 with RLS: `avatars` and `recipe-images` (public read), `source-files` (private; signed URLs, readable by uploader, staff, or anyone who can view the recipe). Allowed: jpg/jpeg/png/webp (+ PDF in `source-files`). Paths are `<user_id>/<random-uuid>.<ext>`; content is verified by magic bytes server-side.

### Auth redirect URLs
In Supabase → Auth → URL configuration set Site URL to `NEXT_PUBLIC_SITE_URL` and add `<site>/auth/callback` to Redirect URLs.

## Scripts
`dev` · `build` · `start` · `lint` · `typecheck` · `test` (core + Vitest) · `test:core` · `test:db` · `test:e2e` · `db:seed` · `db:migrate`

## Deploy (Vercel + Supabase)
1. Create a Supabase project; run `supabase link` then `supabase db push`.
2. Import the repo in Vercel; set the env vars above (service-role key as a server-only secret).
3. `vercel.json` registers the trending cron (every 30 min). Set `CRON_SECRET` in Vercel; Vercel sends it as a Bearer token.
4. Add the production URL to the Supabase auth redirect list; make your first admin (above).

## Testing
- `npm run test:db` — SQL/RLS tests (needs `PGHOST/PGPORT/PGUSER`, see `supabase/tests/run.sh`)
- `npm test` — core logic + Vitest unit tests
- `npm run test:e2e` — Playwright (needs running Supabase, confirmations off; `E2E_ADMIN_EMAIL/PASSWORD` enable the moderation/admin flow)

See [CLAUDE.md](CLAUDE.md) for contributor rules.
