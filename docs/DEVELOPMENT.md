# Development notes

## Verification status (read first)
Built in a sandbox without access to the npm registry. What was and was not actually executed:

| Area | Status |
|---|---|
| SQL migrations 0001–0008, RLS, privileged functions, privacy | **Executed** on Postgres 16: `npm run test:db` → 82 passing assertions |
| Core logic (`src/lib/core`) | **Executed**: `npm run test:core` → 37 passing |
| TypeScript of the app | Checked with `tsc` against hand-written library stubs only; also cross-checked every `.rpc()` name/args, every `select()` column and every FK embed against the real schema. **`next build` has never been run** |
| ESLint, Vitest unit tests, Playwright e2e | **Written but never run** |
| UI in a browser | **Never rendered or clicked** |

First thing to do on a machine with network access: `npm install && npm run typecheck && npm run lint && npm test && npm run build`, then `npm run test:e2e`. Expect some small fixes; treat the e2e selectors as a first draft.

## Formulas
- **Bayesian rating**: `(v·R + m·C) / (v + m)`, m = 8, C = site-wide mean shrunk toward 3.5 (weight 20) so an empty site has a sane prior. Recipes with fewer than 3 reviews show "not enough ratings". "Verified Maker" is shown as a label on reviews by members who logged "I made this"; it does not change the maths.
- **Trending**: `score = (Σ weight·0.5^(age_h / half_life_h) + 0.05·Σ daily_views·0.5^(age_days·24 / half_life_h)) × (0.8 + 0.4·bayes_rating/5)`; half-life by window: day 12 h, week 3 d, month 10 d, year 90 d, all 365 d. Recomputed by `/api/cron/trending` every 30 min (Vercel cron, `Authorization: Bearer $CRON_SECRET`).
- **Badges** (`src/lib/core/badges.ts`): Community Tested ≥3 maker results; Frequently Made ≥10; Well Documented completeness ≥80; Highly Rated ≥5 reviews & weighted ≥4.2; Popular ≥15 likes+saves; Updated Recently (v>1.0, ≤30 days); Community Pick = staff-featured. None claims safety.
- Stats on small samples are hidden (thresholds in `ratings.ts`).

## Deliberate decisions
- **JSON-LD uses schema.org `CreativeWork`, not `Recipe`.** Google's Recipe rich results are for food; using them here would mislabel the content.
- **Experiment visibility "followers"** is stored but behaves like *private* because there is no user-follow feature yet.
- Profile `location`, `notification_prefs`, `age_acknowledged_at` are not publicly selectable (migration 0007); read via `my_private_settings()` / `profile_location()`.
- Creator analytics are aggregate-only (`creator_view_series`); no viewer identities are stored.
- Search: Postgres FTS + pg_trgm + synonyms behind `search_recipes`/`list_recipes`, so Meilisearch/Typesense can replace the RPC later without touching pages.
- Deleting an account anonymises content (`delete_my_account` RPC) then removes the auth user with the service role.

## Known limitations
- Wizard field-error row indices can be off after blank rows are pruned before saving.
- A few admin actions use `window.prompt()` for free-text reasons.
- No email notifications (in-app only); preferences are stored.
- No Meilisearch/Typesense adapter yet.
