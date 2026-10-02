'use server';
import { revalidatePath } from 'next/cache';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { recipeDraftSchema, publishSchema, type RecipeDraft, type RecipeDraftInput } from '@/lib/validators/recipe';
import { scaleRecipe, toGrams } from '@/lib/core/scaler';
import { completeness, publishBlockers } from '@/lib/core/completeness';
import { randomSuffix, slugify } from '@/lib/utils';

/** Fill pct_of_batch / pct_of_tobacco on the child rows from the amounts the author entered. */
function withPercentages(d: RecipeDraft) {
  const twRaw = d.tobacco.weight;
  if (!twRaw || twRaw <= 0) return { base: d.base, aromas: d.aromas };
  // tobacco and batch weights are entered in the recipe's unit; base/aroma weights are always grams
  const tw = toGrams(twRaw, d.units);
  const batchRaw = d.actual_final_weight ?? d.target_batch_weight ?? null;
  try {
    const scaled = scaleRecipe({
      tobacco_weight_g: tw,
      batch_weight_g: batchRaw ? toGrams(batchRaw, d.units) : null,
      base: d.base.map((b, i) => ({ id: `b${i}`, category: b.category, name: b.name, weight_g: b.weight_g, volume_ml: b.volume_ml, density_g_per_ml: b.density_g_per_ml })),
      aromas: d.aromas.map((a, i) => ({ id: `a${i}`, flavour_name: a.flavour_name, weight_g: a.weight_g, volume_ml: a.volume_ml, pct_of_batch: a.pct_of_batch, role: a.role })),
    });
    const by = new Map(scaled.rows.map((r) => [r.id, r]));
    return {
      base: d.base.map((b, i) => ({ ...b, pct_of_batch: by.get(`b${i}`)?.pct_of_batch ?? null, pct_of_tobacco: by.get(`b${i}`)?.pct_of_tobacco ?? null })),
      aromas: d.aromas.map((a, i) => ({ ...a, pct_of_batch: a.pct_of_batch ?? by.get(`a${i}`)?.pct_of_batch ?? null })),
    };
  } catch {
    return { base: d.base, aromas: d.aromas };   // inconsistent numbers (e.g. aromas ≥ 100%): keep as entered, UI shows a warning
  }
}

function coreColumns(d: RecipeDraft) {
  const t = d.tobacco, m = d.maturation, c = d.characteristics;
  const hasChars = Object.values(c).some((v) => v !== null);
  const score = completeness({
    title: d.title, short_description: d.short_description, cover_image_path: d.cover_image_path,
    target_batch_weight: d.target_batch_weight, tobacco_weight: t.weight, tobacco_leaf_family: t.leaf_family,
    tobacco_origin: t.origin, tobacco_brand: t.brand, washed: t.washed,
    base_count: d.base.length, aroma_count: d.aromas.length, step_count: d.steps.length,
    initial_rest_hours: m.initial_rest_hours, recommended_rest_hours: m.recommended_rest_hours, storage_method: m.storage_method,
    has_characteristics: hasChars, profile_count: d.profile_slugs.length, source_count: d.sources.length, creator_notes: d.creator_notes,
  }).score;
  return {
    title: d.title.trim() || 'Untitled recipe',
    short_description: d.short_description, long_description: d.long_description, cover_image_path: d.cover_image_path,
    visibility: d.visibility, units: d.units, target_batch_weight: d.target_batch_weight, actual_final_weight: d.actual_final_weight,
    tobacco_id: t.tobacco_id ?? null, tobacco_weight: t.weight, tobacco_brand: t.brand, tobacco_product_name: t.product_name,
    tobacco_leaf_family: t.leaf_family, tobacco_leaf_type: t.leaf_type, tobacco_variety: t.variety, tobacco_origin: t.origin,
    tobacco_cut: t.cut, tobacco_strength_category: t.strength_category, washed: t.washed, wash_method: t.wash_method,
    wash_duration_minutes: t.wash_duration_minutes, drying_method: t.drying_method, drying_duration_minutes: t.drying_duration_minutes,
    tobacco_notes: t.notes,
    initial_rest_hours: m.initial_rest_hours, recommended_rest_hours: m.recommended_rest_hours,
    rest_temperature_c: m.rest_temperature_c, mixing_schedule: m.mixing_schedule, storage_method: m.storage_method,
    creator_strength: c.strength, creator_sweetness: c.sweetness, creator_flavour_intensity: c.flavour_intensity,
    creator_cooling: c.cooling, creator_cloud: c.cloud, creator_heat_tolerance: c.heat_tolerance, difficulty: c.difficulty,
    equipment: d.equipment, creator_notes: d.creator_notes, completeness: score,
  };
}

export interface SavedRecipe { id: string; slug: string; completeness: number; savedAt: string }

/**
 * Create or update a recipe (draft or live). Used by the wizard's auto-save and by editing.
 * Child rows are replaced atomically by the save_recipe_children() database function.
 */
export async function saveRecipe(input: RecipeDraftInput): Promise<ActionResult<SavedRecipe>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = recipeDraftSchema.safeParse(input);
  if (!parsed.success) return fail('Some fields need attention.', 'invalid', zodFieldErrors(parsed.error));
  const d = parsed.data;
  const { supabase, viewer } = a;
  const core = coreColumns(d);
  const { base, aromas } = withPercentages(d);

  let id = d.id ?? null;
  let slug: string;
  if (id) {
    const { data, error } = await supabase.from('recipes').update(core).eq('id', id).select('id, slug').maybeSingle();
    if (error) return fromDbError(error);
    if (!data) return fail('That recipe could not be found or is not yours.', 'not_found');
    slug = data.slug;
  } else {
    slug = `${slugify(core.title)}-${randomSuffix()}`;
    const { data, error } = await supabase.from('recipes')
      .insert({ ...core, slug, creator_id: viewer.id, status: 'draft' }).select('id').single();
    if (error) return fromDbError(error);
    id = data.id as string;
  }

  const { error: childErr } = await supabase.rpc('save_recipe_children', {
    p_recipe: id, p_base: base, p_aromas: aromas, p_steps: d.steps, p_sources: d.sources, p_tags: d.tags, p_profiles: d.profile_slugs,
  });
  if (childErr) return fromDbError(childErr);

  revalidatePath('/me');
  return ok({ id: id as string, slug, completeness: core.completeness, savedAt: new Date().toISOString() });
}

/** Publish a draft (v1.0) or publish a new version of a live recipe (requires change notes). */
export async function publishRecipe(recipeId: string, raw: { change_notes?: string | null; bump?: 'minor' | 'major' }): Promise<ActionResult<{ slug: string; version: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = publishSchema.safeParse(raw);
  if (!parsed.success) return fail('Check the change notes.', 'invalid', zodFieldErrors(parsed.error));
  const { data, error } = await a.supabase.rpc('publish_recipe', {
    p_recipe: recipeId, p_change_notes: parsed.data.change_notes, p_bump: parsed.data.bump,
  });
  if (error) return fromDbError(error);
  const v = data as { version_major: number; version_minor: number };
  const { data: r } = await a.supabase.from('recipes').select('slug').eq('id', recipeId).single();
  revalidatePath('/recipes'); revalidatePath('/'); revalidatePath('/me');
  if (r?.slug) revalidatePath(`/recipes/${r.slug}`);
  return ok({ slug: r?.slug as string, version: `v${v.version_major}.${v.version_minor}` }, 'Published.');
}

export async function getPublishBlockers(recipeId: string): Promise<string[]> {
  const a = await authed();
  if ('error' in a) return ['Please sign in.'];
  const { data: r } = await a.supabase.from('recipes').select('title, tobacco_weight, tobacco_leaf_family').eq('id', recipeId).maybeSingle();
  if (!r) return ['Recipe not found.'];
  const [aroma, step] = await Promise.all([
    a.supabase.from('recipe_aromas').select('id', { count: 'exact', head: true }).eq('recipe_id', recipeId),
    a.supabase.from('recipe_steps').select('id', { count: 'exact', head: true }).eq('recipe_id', recipeId),
  ]);
  return publishBlockers({
    title: r.title, tobacco_weight: r.tobacco_weight, tobacco_leaf_family: r.tobacco_leaf_family,
    base_count: 0, aroma_count: aroma.count ?? 0, step_count: step.count ?? 0, has_characteristics: false, profile_count: 0, source_count: 0,
  });
}

export async function setRecipeArchived(recipeId: string, archived: boolean): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('recipes').update({ status: archived ? 'archived' : 'published' })
    .eq('id', recipeId).select('slug').maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return fail('That recipe could not be found.', 'not_found');
  revalidatePath('/recipes'); revalidatePath('/me'); revalidatePath(`/recipes/${data.slug}`);
  return ok(undefined, archived ? 'Recipe archived.' : 'Recipe restored.');
}

export async function setRecipeVisibility(recipeId: string, visibility: 'public' | 'unlisted' | 'private'): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('recipes').update({ visibility }).eq('id', recipeId).select('slug').maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return fail('That recipe could not be found.', 'not_found');
  revalidatePath('/recipes'); revalidatePath('/me'); revalidatePath(`/recipes/${data.slug}`);
  return ok(undefined, 'Visibility updated.');
}

/** Only unpublished drafts can be deleted by their owner (RLS); published recipes keep their history. */
export async function deleteDraft(recipeId: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('recipes').delete().eq('id', recipeId).eq('status', 'draft').select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('Only drafts can be deleted. Archive a published recipe instead.', 'forbidden');
  revalidatePath('/me');
  return ok(undefined, 'Draft deleted.');
}

/** Load a recipe in wizard shape for editing (owner only — RLS). */
export async function loadRecipeForEdit(recipeId: string): Promise<ActionResult<RecipeDraftInput & { status: string; slug: string; version: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const s = a.supabase;
  const { data: r } = await s.from('recipes').select('*').eq('id', recipeId).eq('creator_id', a.viewer.id).maybeSingle();
  if (!r) return fail('That recipe could not be found.', 'not_found');
  const [base, aromas, steps, sources, tags, profiles] = await Promise.all([
    s.from('recipe_base_ingredients').select('*').eq('recipe_id', recipeId).order('position'),
    s.from('recipe_aromas').select('*').eq('recipe_id', recipeId).order('position'),
    s.from('recipe_steps').select('*').eq('recipe_id', recipeId).order('step_number'),
    s.from('recipe_sources').select('*').eq('recipe_id', recipeId).order('position'),
    s.from('recipe_tags').select('tags(slug)').eq('recipe_id', recipeId),
    s.from('recipe_flavour_profiles').select('flavour_profiles(slug)').eq('recipe_id', recipeId),
  ]);
  const slugs = (rows: unknown, key: string) => ((rows ?? []) as Record<string, { slug: string } | null>[]).map((x) => x[key]?.slug).filter((x): x is string => !!x);
  return ok({
    id: r.id, slug: r.slug, status: r.status, version: `v${r.version_major}.${r.version_minor}`,
    title: r.status === 'draft' && r.title === 'Untitled recipe' ? '' : r.title,
    short_description: r.short_description, long_description: r.long_description, cover_image_path: r.cover_image_path,
    visibility: r.visibility, units: r.units, target_batch_weight: r.target_batch_weight, actual_final_weight: r.actual_final_weight,
    tobacco: {
      tobacco_id: r.tobacco_id, brand: r.tobacco_brand, product_name: r.tobacco_product_name, leaf_family: r.tobacco_leaf_family,
      leaf_type: r.tobacco_leaf_type, variety: r.tobacco_variety, origin: r.tobacco_origin, cut: r.tobacco_cut,
      strength_category: r.tobacco_strength_category, weight: r.tobacco_weight, washed: r.washed, wash_method: r.wash_method,
      wash_duration_minutes: r.wash_duration_minutes, drying_method: r.drying_method, drying_duration_minutes: r.drying_duration_minutes,
      notes: r.tobacco_notes,
    },
    base: base.data ?? [], aromas: aromas.data ?? [],
    steps: (steps.data ?? []).map((x: Record<string, unknown>) => ({ ...x })),
    sources: (sources.data ?? []),
    maturation: {
      initial_rest_hours: r.initial_rest_hours, recommended_rest_hours: r.recommended_rest_hours,
      rest_temperature_c: r.rest_temperature_c, mixing_schedule: r.mixing_schedule, storage_method: r.storage_method,
    },
    characteristics: {
      strength: r.creator_strength, sweetness: r.creator_sweetness, flavour_intensity: r.creator_flavour_intensity,
      cooling: r.creator_cooling, cloud: r.creator_cloud, heat_tolerance: r.creator_heat_tolerance, difficulty: r.difficulty,
    },
    profile_slugs: slugs(profiles.data, 'flavour_profiles'), tags: slugs(tags.data, 'tags'),
    equipment: r.equipment ?? [], creator_notes: r.creator_notes,
  } as RecipeDraftInput & { status: string; slug: string; version: string });
}
