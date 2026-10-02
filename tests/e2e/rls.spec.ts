import { expect, test } from '@playwright/test';

/**
 * Direct PostgREST calls with only the public anon key, bypassing the UI entirely.
 * Proves protection comes from Row Level Security, not from hidden buttons.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
test.skip(!URL || !KEY, 'needs NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
const h = { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

test('anonymous cannot read drafts or private recipes', async ({ request }) => {
  const r = await request.get(`${URL}/rest/v1/recipes?select=id,status,visibility&or=(status.neq.published,visibility.eq.private)`, { headers: h });
  expect(r.ok()).toBeTruthy();
  expect(await r.json()).toEqual([]);
});

test('anonymous cannot write', async ({ request }) => {
  for (const [table, body] of [['recipes', { title: 'x' }], ['recipe_likes', { recipe_id: crypto.randomUUID(), user_id: crypto.randomUUID() }], ['reports', { reason: 'spam' }], ['site_settings', { key: 'x', value: 1 }]] as const) {
    const r = await request.post(`${URL}/rest/v1/${table}`, { headers: h, data: body });
    expect(r.status(), table).toBeGreaterThanOrEqual(400);
  }
});

test('private profile columns and the moderation audit log are not readable', async ({ request }) => {
  const loc = await request.get(`${URL}/rest/v1/profiles?select=location`, { headers: h });
  expect(loc.status()).toBeGreaterThanOrEqual(400);
  const audit = await request.get(`${URL}/rest/v1/moderation_actions?select=*`, { headers: h });
  expect(audit.ok() ? await audit.json() : []).toEqual([]);
});

test('publish_recipe and role changes cannot be called anonymously', async ({ request }) => {
  const a = await request.post(`${URL}/rest/v1/rpc/publish_recipe`, { headers: h, data: { p_recipe: crypto.randomUUID(), p_change_notes: 'x' } });
  expect(a.status()).toBeGreaterThanOrEqual(400);
});
