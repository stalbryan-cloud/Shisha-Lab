'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, type ActionResult } from '@/lib/actions/result';

const id = z.string().uuid();

async function toggle(table: 'recipe_likes' | 'recipe_saves', recipeId: string, on: boolean, slug?: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  if (!id.safeParse(recipeId).success) return fail('Invalid recipe.', 'invalid');
  const q = on
    ? a.supabase.from(table).insert({ recipe_id: recipeId, user_id: a.viewer.id })
    : a.supabase.from(table).delete().eq('recipe_id', recipeId).eq('user_id', a.viewer.id);
  const { error } = await q;
  if (error && error.code !== '23505') return fromDbError(error);   // 23505 = already liked/saved: idempotent
  if (slug) revalidatePath(`/recipes/${slug}`);
  revalidatePath('/me');
  return ok();
}
export const setLike = (recipeId: string, on: boolean, slug?: string) => toggle('recipe_likes', recipeId, on, slug);
export const setSave = (recipeId: string, on: boolean, slug?: string) => toggle('recipe_saves', recipeId, on, slug);

export async function createCollection(name: string): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const n = name.trim();
  if (n.length < 1 || n.length > 60) return fail('Give the collection a name (up to 60 characters).', 'invalid');
  const { data, error } = await a.supabase.from('collections').insert({ user_id: a.viewer.id, name: n }).select('id').single();
  if (error) return error.code === '23505' ? fail('You already have a collection with that name.', 'duplicate') : fromDbError(error);
  revalidatePath('/me');
  return ok({ id: data.id as string });
}

export async function setInCollection(collectionId: string, recipeId: string, on: boolean): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const q = on
    ? a.supabase.from('collection_recipes').insert({ collection_id: collectionId, recipe_id: recipeId })
    : a.supabase.from('collection_recipes').delete().eq('collection_id', collectionId).eq('recipe_id', recipeId);
  const { error } = await q;
  if (error && error.code !== '23505') return fromDbError(error);
  revalidatePath('/me');
  return ok();
}

export async function deleteCollection(collectionId: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from('collections').delete().eq('id', collectionId).eq('user_id', a.viewer.id);
  if (error) return fromDbError(error);
  revalidatePath('/me');
  return ok(undefined, 'Collection deleted.');
}

/** Public view counter (aggregate only; no user identifiers stored). De-duplicated per browser session by a cookie. */
export async function recordView(recipeId: string): Promise<void> {
  if (!id.safeParse(recipeId).success) return;
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const key = `v_${recipeId.slice(0, 8)}`;
  if (jar.get(key)) return;
  try { jar.set(key, '1', { maxAge: 1800, httpOnly: true, sameSite: 'lax', path: '/' }); } catch { return; }
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  await supabase.rpc('record_recipe_view', { p_recipe: recipeId });
}
