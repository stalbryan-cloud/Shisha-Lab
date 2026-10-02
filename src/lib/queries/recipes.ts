import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Paged, RecipeCardData } from '@/lib/types';
import { PAGE_SIZE, restBucketHours, sinceToDate, type RecipeFilters } from '@/lib/core/filters';

const CARD_SELECT = `
  id, slug, title, short_description, cover_image_path, tobacco_leaf_family, tobacco_leaf_type,
  creator_strength, creator_sweetness, initial_rest_hours, recommended_rest_hours, version_major, version_minor,
  published_at, updated_at, is_featured, completeness, like_count, save_count, made_count, view_count, comment_count,
  review_count, rating_sum, bayes_rating,
  creator:profiles!recipes_creator_id_fkey(username, display_name, avatar_path),
  aromas:recipe_aromas(flavour_name, pct_of_batch, position),
  profiles:recipe_flavour_profiles(flavour_profiles(slug, name))`;

type RawCard = Omit<RecipeCardData, 'profiles'> & { profiles: { flavour_profiles: { slug: string; name: string } | null }[] };

function normaliseCard(r: RawCard): RecipeCardData {
  return {
    ...r,
    aromas: [...(r.aromas ?? [])].sort((a, b) => a.position - b.position),
    profiles: (r.profiles ?? []).map((p) => p.flavour_profiles).filter((p): p is { slug: string; name: string } => !!p),
  };
}

/** Fetch cards for a list of ids in ONE query, preserving the given order (no N+1). */
export async function fetchCards(ids: string[]): Promise<RecipeCardData[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('recipes').select(CARD_SELECT).in('id', ids);
  if (error) throw new Error('Could not load recipes');
  const byId = new Map((data as unknown as RawCard[]).map((r) => [r.id, normaliseCard(r)]));
  return ids.map((id) => byId.get(id)).filter((r): r is RecipeCardData => !!r);
}

export function filtersToRpcArgs(f: RecipeFilters, extra: { limit?: number; creator?: string | null } = {}) {
  const arr = (a: string[]) => (a.length ? a : null);
  const rest = f.rest ? restBucketHours(f.rest) : { min: null, max: null };
  const sort = f.q && f.sort === 'trending' ? 'relevance' : f.sort;
  const limit = extra.limit ?? PAGE_SIZE;
  return {
    p_q: f.q || null, p_family: arr(f.family), p_leaf: arr(f.leaf), p_brand: arr(f.brand), p_origin: arr(f.origin),
    p_washed: f.washed === null ? null : f.washed === 'yes', p_sweetener: arr(f.sweetener),
    p_aroma_brand: arr(f.aromaBrand), p_flavour: arr(f.flavour), p_profile: arr(f.profile),
    p_strength: f.strength, p_intensity: f.intensity, p_sweetness: f.sweetness,
    p_rest_min: rest.min, p_rest_max: rest.max, p_min_rating: f.minRating, p_min_reviews: f.minReviews,
    p_since: f.since ? sinceToDate(f.since).toISOString() : null, p_tested: f.tested, p_have: arr(f.have),
    p_sort: sort, p_limit: limit, p_offset: (f.page - 1) * limit, p_creator: extra.creator ?? null,
  };
}

export async function listRecipes(f: RecipeFilters, extra: { limit?: number; creator?: string | null } = {}): Promise<Paged<RecipeCardData>> {
  const supabase = await createClient();
  const args = filtersToRpcArgs(f, extra);
  const { data, error } = await supabase.rpc('list_recipes', args);
  if (error) throw new Error('Could not load recipes');
  const rows = (data ?? []) as { id: string; total: number }[];
  return {
    items: await fetchCards(rows.map((r) => r.id)),
    total: Number(rows[0]?.total ?? 0),
    page: f.page,
    pageSize: args.p_limit,
  };
}

export type TrendingWindow = 'day' | 'week' | 'month' | 'year' | 'all';
export const TRENDING_LABELS: Record<TrendingWindow, string> = {
  day: 'Today', week: 'This week', month: 'This month', year: 'This year', all: 'All time',
};
export const isTrendingWindow = (v: string | undefined): v is TrendingWindow =>
  v === 'day' || v === 'week' || v === 'month' || v === 'year' || v === 'all';

export async function trendingRecipes(window: TrendingWindow, limit = 8): Promise<RecipeCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('trending_recipes', { p_window: window, p_limit: limit, p_offset: 0 });
  return fetchCards(((data ?? []) as { recipe_id: string }[]).map((r) => r.recipe_id));
}

export async function communityPicks(limit = 6): Promise<RecipeCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('recipes').select('id').eq('is_featured', true).eq('status', 'published')
    .eq('visibility', 'public').eq('moderation', 'visible').order('featured_at', { ascending: false }).limit(limit);
  return fetchCards((data ?? []).map((r: { id: string }) => r.id));
}

export async function similarRecipes(recipeId: string, limit = 6): Promise<RecipeCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('similar_recipes', { p_recipe: recipeId, p_limit: limit });
  return fetchCards(((data ?? []) as { id: string }[]).map((r) => r.id));
}

export async function communityStats() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('community_stats');
  return (data ?? {}) as Record<'recipes' | 'experiments' | 'members' | 'ratings' | 'discussions' | 'recreations', number>;
}

export async function popularProfiles(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('popular_profiles', { p_limit: limit });
  return (data ?? []) as { slug: string; name: string; recipe_count: number }[];
}

export interface Facet { slug?: string; name: string; count: number; family?: string }
export async function exploreFacets() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('explore_facets');
  const d = (data ?? {}) as Partial<Record<'flavours' | 'aroma_brands' | 'leaf_types' | 'origins' | 'profiles', Facet[]>>;
  return {
    flavours: d.flavours ?? [], aroma_brands: d.aroma_brands ?? [], leaf_types: d.leaf_types ?? [],
    origins: d.origins ?? [], profiles: d.profiles ?? [],
  };
}
