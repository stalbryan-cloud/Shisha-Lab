'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, type ActionResult } from '@/lib/actions/result';
import { slugify } from '@/lib/utils';

async function admin() {
  const a = await authed();
  if ('error' in a) return a;
  if (a.viewer.role !== 'admin') return { error: fail('Administrator access is required.', 'forbidden') } as const;
  return a;
}
async function staffOrAdmin() {
  const a = await authed();
  if ('error' in a) return a;
  if (a.viewer.role !== 'admin' && a.viewer.role !== 'moderator') return { error: fail('Access denied.', 'forbidden') } as const;
  return a;
}

export async function changeRole(userId: string, role: 'user' | 'trusted_user' | 'moderator' | 'admin', why?: string): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  if (!['user', 'trusted_user', 'moderator', 'admin'].includes(role)) return fail('Unknown role.', 'invalid');
  const { error } = await a.supabase.rpc('admin_set_role', { p_user: userId, p_role: role, p_reason: why ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/admin/users');
  return ok(undefined, 'Role updated.');
}

export async function mergeFlavours(fromId: string, intoId: string, why?: string): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.rpc('admin_merge_flavours', { p_from: fromId, p_into: intoId, p_reason: why ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/admin/ingredients');
  return ok(undefined, 'Flavours merged. The old name now works as a synonym.');
}

// ───── forum categories ─────
const category = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(200).optional() });

export async function saveCategory(input: { id?: string; name: string; description?: string }): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const p = category.safeParse(input);
  if (!p.success) return fail('Give the category a name (2–60 characters).', 'invalid');
  const { error } = input.id
    ? await a.supabase.from('forum_categories').update({ name: p.data.name, description: p.data.description ?? null }).eq('id', input.id)
    : await a.supabase.from('forum_categories').insert({ name: p.data.name, description: p.data.description ?? null, slug: slugify(p.data.name, 40), sort_order: 999 });
  if (error) return fromDbError(error);
  revalidatePath('/admin/forum'); revalidatePath('/community');
  return ok(undefined, 'Category saved.');
}

export async function reorderCategories(idsInOrder: string[]): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const results = await Promise.all(idsInOrder.map((cid, i) => a.supabase.from('forum_categories').update({ sort_order: i + 1 }).eq('id', cid)));
  const bad = results.find((r) => r.error);
  if (bad?.error) return fromDbError(bad.error);
  revalidatePath('/admin/forum'); revalidatePath('/community');
  return ok(undefined, 'Order saved.');
}

export async function archiveCategory(categoryId: string, archived: boolean): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from('forum_categories').update({ is_archived: archived }).eq('id', categoryId);
  if (error) return fromDbError(error);
  revalidatePath('/admin/forum'); revalidatePath('/community');
  return ok();
}

export async function setCategoryModerator(categoryId: string, username: string, on: boolean): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const { data: p } = await a.supabase.from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
  if (!p) return fail('No member with that username.', 'not_found');
  const { error } = on
    ? await a.supabase.from('forum_category_moderators').insert({ category_id: categoryId, user_id: p.id })
    : await a.supabase.from('forum_category_moderators').delete().eq('category_id', categoryId).eq('user_id', p.id);
  if (error && error.code !== '23505') return fromDbError(error);
  revalidatePath('/admin/forum');
  return ok();
}

// ───── ingredient database (informational only — no purchase links) ─────
type IngredientTable = 'aroma_brands' | 'aromas' | 'tobacco_brands' | 'tobaccos' | 'flavours' | 'flavour_synonyms' | 'tobacco_leaf_types';

const entity = {
  aroma_brands: z.object({ name: z.string().trim().min(2).max(80), country: z.string().trim().max(60).optional() }),
  tobacco_brands: z.object({ name: z.string().trim().min(2).max(80), country: z.string().trim().max(60).optional() }),
  flavours: z.object({ name: z.string().trim().min(2).max(60) }),
  flavour_synonyms: z.object({ term: z.string().trim().toLowerCase().min(2).max(60), flavour_id: z.string().uuid() }),
  aromas: z.object({ product_name: z.string().trim().min(2).max(100), brand_id: z.string().uuid().nullable().optional(),
    concentration_notes: z.string().trim().max(300).optional(), community_notes: z.string().trim().max(1000).optional(),
    recommended_min_pct: z.coerce.number().min(0).max(50).nullable().optional(), recommended_max_pct: z.coerce.number().min(0).max(50).nullable().optional() }),
  tobaccos: z.object({ product_name: z.string().trim().min(2).max(100), brand_id: z.string().uuid().nullable().optional(),
    leaf_type_id: z.string().uuid().nullable().optional(), variety: z.string().trim().max(80).optional(), origin: z.string().trim().max(80).optional(),
    cut: z.string().trim().max(40).optional(), notes: z.string().trim().max(1000).optional() }),
  tobacco_leaf_types: z.object({ name: z.string().trim().min(2).max(60), family: z.enum(['blonde', 'dark', 'other']) }),
} as const;

export async function saveEntity(table: IngredientTable, input: Record<string, unknown> & { id?: string }): Promise<ActionResult> {
  const a = await staffOrAdmin();
  if ('error' in a) return a.error;
  const schema = entity[table];
  if (!schema) return fail('Unknown table.', 'invalid');
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid input.', 'invalid');
  const row: Record<string, unknown> = { ...parsed.data };
  const named = (row.name ?? row.product_name) as string | undefined;
  const { error } = input.id
    ? await a.supabase.from(table).update(row).eq('id', input.id)
    : await a.supabase.from(table).insert(table === 'flavour_synonyms' ? row : { ...row, slug: slugify(named ?? 'item', 60) });
  if (error) return error.code === '23505' ? fail('An entry with that name already exists.', 'duplicate') : fromDbError(error);
  revalidatePath('/admin/ingredients'); revalidatePath('/explore');
  return ok(undefined, 'Saved.');
}

export async function deleteEntity(table: 'flavour_synonyms' | 'aromas' | 'tobaccos' | 'aroma_brands' | 'tobacco_brands', entityId: string): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from(table).delete().eq('id', entityId);
  if (error) return fromDbError(error);
  revalidatePath('/admin/ingredients');
  return ok(undefined, 'Deleted.');
}

// ───── site settings ─────
const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
  site_name: z.string().trim().min(2).max(40),
  // empty text = no banner (jsonb NULL cannot be sent through PostgREST upserts)
  announcement: z.object({ text: z.string().trim().max(280), tone: z.enum(['info', 'warning']).default('info') }),
  age_notice: z.string().trim().max(1000), responsible_use_notice: z.string().trim().max(1000),
  jurisdiction_notice: z.string().trim().max(1000), health_notice: z.string().trim().max(1000), community_rules: z.string().trim().max(5000),
  forum_delete_window_minutes: z.coerce.number().int().min(0).max(1440),
  upload_max_image_mb: z.coerce.number().min(0.5).max(25), upload_max_pdf_mb: z.coerce.number().min(0.5).max(50),
  uploads_pdf_enabled: z.coerce.boolean(), age_minimum: z.coerce.number().int().min(16).max(25),
};

export async function updateSetting(key: string, value: unknown): Promise<ActionResult> {
  const a = await admin();
  if ('error' in a) return a.error;
  const schema = SETTING_SCHEMAS[key];
  if (!schema) return fail('Unknown setting.', 'invalid');
  const parsed = schema.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid value.', 'invalid');
  const { error } = await a.supabase.from('site_settings').upsert({ key, value: parsed.data, updated_by: a.viewer.id, updated_at: new Date().toISOString() });
  if (error) return fromDbError(error);
  revalidatePath('/', 'layout');
  return ok(undefined, 'Setting saved.');
}
