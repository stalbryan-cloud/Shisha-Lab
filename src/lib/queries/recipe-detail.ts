import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  AromaRow, BaseIngredientRow, CommentRow, ExperimentRow, ProfileLite, RecipeRow, ReviewRow, SourceRow, StepRow, VersionRow,
} from '@/lib/types';

export interface RecipeDetail {
  recipe: RecipeRow;
  creator: ProfileLite | null;
  base: BaseIngredientRow[];
  aromas: AromaRow[];
  steps: StepRow[];
  sources: SourceRow[];
  versions: VersionRow[];
  profiles: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
}

export async function getRecipeBySlug(slug: string): Promise<RecipeDetail | null> {
  const supabase = await createClient();
  const { data: recipe } = await supabase.from('recipes').select('*').eq('slug', slug).maybeSingle();
  if (!recipe) return null;   // RLS hides private/unpublished recipes from everyone but the owner and staff
  const id = recipe.id as string;
  const [creator, base, aromas, steps, sources, versions, profiles, tags] = await Promise.all([
    recipe.creator_id
      ? supabase.from('profiles').select('username, display_name, avatar_path').eq('id', recipe.creator_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('recipe_base_ingredients').select('*').eq('recipe_id', id).order('position'),
    supabase.from('recipe_aromas').select('*').eq('recipe_id', id).order('position'),
    supabase.from('recipe_steps').select('*').eq('recipe_id', id).order('step_number'),
    supabase.from('recipe_sources').select('*').eq('recipe_id', id).order('position'),
    supabase.from('recipe_versions').select('id, version_major, version_minor, change_notes, created_at').eq('recipe_id', id)
      .order('version_major', { ascending: false }).order('version_minor', { ascending: false }),
    supabase.from('recipe_flavour_profiles').select('flavour_profiles(slug, name)').eq('recipe_id', id),
    supabase.from('recipe_tags').select('tags(slug, name)').eq('recipe_id', id),
  ]);
  type Joined<K extends string, T> = { [P in K]: T | null }[];
  return {
    recipe: recipe as RecipeRow,
    creator: (creator.data as ProfileLite | null) ?? null,
    base: (base.data ?? []) as BaseIngredientRow[],
    aromas: (aromas.data ?? []) as AromaRow[],
    steps: (steps.data ?? []) as StepRow[],
    sources: (sources.data ?? []) as SourceRow[],
    versions: (versions.data ?? []) as VersionRow[],
    profiles: ((profiles.data ?? []) as unknown as Joined<'flavour_profiles', { slug: string; name: string }>)
      .map((p) => p.flavour_profiles).filter((p): p is { slug: string; name: string } => !!p),
    tags: ((tags.data ?? []) as unknown as Joined<'tags', { slug: string; name: string }>)
      .map((t) => t.tags).filter((t): t is { slug: string; name: string } => !!t),
  };
}

/** A specific historical version, reconstructed from its immutable snapshot. */
export async function getVersionSnapshot(recipeId: string, major: number, minor: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('recipe_versions').select('*').eq('recipe_id', recipeId)
    .eq('version_major', major).eq('version_minor', minor).maybeSingle();
  return data as (VersionRow & { snapshot: {
    recipe: Partial<RecipeRow>; base_ingredients: BaseIngredientRow[]; aromas: AromaRow[]; steps: StepRow[];
    sources: SourceRow[]; tags: string[]; profiles: string[];
  } }) | null;
}

export async function getViewerState(recipeId: string, userId: string | null) {
  if (!userId) return { liked: false, saved: false, review: null as ReviewRow | null, experiment: null as { id: string } | null };
  const supabase = await createClient();
  const [like, save, review, exp] = await Promise.all([
    supabase.from('recipe_likes').select('recipe_id').eq('recipe_id', recipeId).eq('user_id', userId).maybeSingle(),
    supabase.from('recipe_saves').select('recipe_id').eq('recipe_id', recipeId).eq('user_id', userId).maybeSingle(),
    supabase.from('recipe_reviews').select('*').eq('recipe_id', recipeId).eq('user_id', userId).maybeSingle(),
    supabase.from('recipe_experiments').select('id').eq('recipe_id', recipeId).eq('user_id', userId).limit(1),
  ]);
  return {
    liked: !!like.data, saved: !!save.data,
    review: (review.data as ReviewRow | null) ?? null,
    experiment: ((exp.data ?? [])[0] as { id: string } | undefined) ?? null,
  };
}

const AUTHOR = 'author:profiles!{fk}(username, display_name, avatar_path)';

export async function getReviews(recipeId: string, limit = 30): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('recipe_reviews')
    .select(`*, ${AUTHOR.replace('{fk}', 'recipe_reviews_user_id_fkey')}`)
    .eq('recipe_id', recipeId).eq('moderation', 'visible').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as ReviewRow[];
}

/** Verified maker rating = average of reviews whose author said they made the recipe (exactly or modified). */
export function makerRating(r: Pick<RecipeRow, 'maker_review_count' | 'maker_rating_sum'>): { avg: number | null; count: number } {
  return { count: r.maker_review_count, avg: r.maker_review_count > 0 ? r.maker_rating_sum / r.maker_review_count : null };
}

export async function getExperiments(recipeId: string, limit = 50): Promise<ExperimentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('recipe_experiments')
    .select(`*, ${AUTHOR.replace('{fk}', 'recipe_experiments_user_id_fkey')}, changes:experiment_changes(kind, description)`)
    .eq('recipe_id', recipeId).eq('moderation', 'visible').eq('visibility', 'public')
    .order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as ExperimentRow[];
}

export async function getComments(recipeId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('comments')
    .select(`*, ${AUTHOR.replace('{fk}', 'comments_user_id_fkey')}`)
    .eq('recipe_id', recipeId).order('created_at', { ascending: true }).limit(500);
  return (data ?? []) as unknown as CommentRow[];
}

/** Which of these users have logged a result for this recipe → "Made This Recipe" badge. */
export async function getMakerIds(recipeId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from('recipe_experiments').select('user_id').eq('recipe_id', recipeId)
    .eq('moderation', 'visible').eq('visibility', 'public');
  return new Set((data ?? []).map((r: { user_id: string | null }) => r.user_id).filter((x): x is string => !!x));
}

export async function getVotedCommentIds(recipeId: string, userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from('comment_votes').select('comment_id, comments!inner(recipe_id)')
    .eq('user_id', userId).eq('comments.recipe_id', recipeId);
  return new Set((data ?? []).map((r: { comment_id: string }) => r.comment_id));
}

export async function getModeratorIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from('user_roles').select('user_id, role').in('user_id', userIds).in('role', ['moderator', 'admin']);
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
}
