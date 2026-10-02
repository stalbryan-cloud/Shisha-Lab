'use server';
import { revalidatePath } from 'next/cache';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { experimentSchema, reviewSchema } from '@/lib/validators/community';

async function slugOf(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, recipeId: string) {
  const { data } = await supabase.from('recipes').select('slug, version_major, version_minor, creator_id').eq('id', recipeId).maybeSingle();
  return data as { slug: string; version_major: number; version_minor: number; creator_id: string | null } | null;
}

/** Create or update the viewer's single rating for a recipe (unique per account; DB enforces it). */
export async function submitReview(input: Record<string, unknown>): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail('Please check your rating.', 'invalid', zodFieldErrors(parsed.error));
  const d = parsed.data;
  const recipe = await slugOf(a.supabase, d.recipe_id);
  if (!recipe) return fail('That recipe could not be found.', 'not_found');
  if (recipe.creator_id === a.viewer.id) return fail('You cannot rate your own recipe.', 'forbidden');

  const fields = {
    maker_status: d.maker_status, overall: d.overall, flavour: d.flavour, balance: d.balance, ease: d.ease, cloud: d.cloud,
    heat_tolerance: d.heat_tolerance, body: d.body, version_major: recipe.version_major, version_minor: recipe.version_minor,
  };
  const { data: existing } = await a.supabase.from('recipe_reviews').select('id').eq('recipe_id', d.recipe_id).eq('user_id', a.viewer.id).maybeSingle();
  const { error } = existing
    ? await a.supabase.from('recipe_reviews').update(fields).eq('id', existing.id)
    : await a.supabase.from('recipe_reviews').insert({ ...fields, recipe_id: d.recipe_id, user_id: a.viewer.id });
  if (error) return fromDbError(error);
  revalidatePath(`/recipes/${recipe.slug}`); revalidatePath('/me');
  return ok(undefined, existing ? 'Your rating was updated.' : 'Thanks for rating this recipe!');
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('recipe_reviews').delete().eq('id', reviewId).eq('user_id', a.viewer.id).select('recipe_id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('That review could not be found.', 'not_found');
  const r = await slugOf(a.supabase, data[0].recipe_id);
  if (r) revalidatePath(`/recipes/${r.slug}`);
  return ok(undefined, 'Rating removed.');
}

/** "I made this" — creates an experiment/result report (separate from the star rating). */
export async function submitExperiment(input: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = experimentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the highlighted fields.', 'invalid', zodFieldErrors(parsed.error));
  const { changes, ...d } = parsed.data;
  const recipe = await slugOf(a.supabase, d.recipe_id);
  if (!recipe) return fail('That recipe could not be found.', 'not_found');
  if (!d.followed_exactly && changes.length === 0) return fail('Describe what you changed (or mark it as followed exactly).', 'invalid', { changes: ['Add at least one change'] });

  const { data, error } = await a.supabase.from('recipe_experiments')
    .insert({ ...d, user_id: a.viewer.id, followed_exactly: d.followed_exactly }).select('id').single();
  if (error) return fromDbError(error);
  if (!d.followed_exactly && changes.length) {
    const { error: cErr } = await a.supabase.from('experiment_changes').insert(changes.map((c) => ({ ...c, experiment_id: data.id })));
    if (cErr) return fromDbError(cErr);
  }
  revalidatePath(`/recipes/${recipe.slug}`); revalidatePath('/me');
  return ok({ id: data.id as string }, 'Result logged. Thank you!');
}

export async function addExperimentImage(experimentId: string, path: string, alt?: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  if (!path.startsWith(`${a.viewer.id}/`)) return fail('Invalid file.', 'invalid');
  const { error } = await a.supabase.from('experiment_images').insert({ experiment_id: experimentId, path, alt_text: alt?.slice(0, 200) ?? null });
  return error ? fromDbError(error) : ok();
}

export async function deleteExperiment(experimentId: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('recipe_experiments').delete().eq('id', experimentId).eq('user_id', a.viewer.id).select('recipe_id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('That result could not be found.', 'not_found');
  const r = await slugOf(a.supabase, data[0].recipe_id);
  if (r) revalidatePath(`/recipes/${r.slug}`);
  revalidatePath('/me');
  return ok(undefined, 'Result deleted.');
}

export async function updateExperimentVisibility(experimentId: string, visibility: 'public' | 'followers' | 'private'): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from('recipe_experiments').update({ visibility }).eq('id', experimentId).eq('user_id', a.viewer.id);
  if (error) return fromDbError(error);
  revalidatePath('/me');
  return ok(undefined, 'Visibility updated.');
}
