/** Recipe-list filter state <-> URL query string. Pure functions; the URL is the single source of truth. */

export const SORTS = ['trending', 'rating', 'rated', 'made', 'saved', 'newest', 'oldest', 'discussed'] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  trending: 'Trending', rating: 'Highest rated', rated: 'Most rated', made: 'Most made',
  saved: 'Most saved', newest: 'Newest', oldest: 'Oldest', discussed: 'Most discussed',
};
export const FAMILIES = ['blonde', 'dark', 'other'] as const;
export const SWEETENER_CATEGORIES = ['honey', 'molasses', 'invert_syrup', 'glucose_syrup'] as const;
export const SINCE_OPTIONS = ['7d', '30d', '90d', '365d'] as const;
export const REST_BUCKETS = ['lt24', '24-72', '72-168', 'gt168'] as const;
export const PAGE_SIZE = 24;

export interface RecipeFilters {
  q: string;
  family: string[];
  leaf: string[];
  brand: string[];          // tobacco manufacturer
  origin: string[];
  washed: 'yes' | 'no' | null;
  sweetener: string[];
  aromaBrand: string[];
  flavour: string[];        // flavour slugs (AND)
  profile: string[];        // flavour profile slugs (AND)
  strength: [number, number] | null;      // creator_strength range 1–5
  intensity: [number, number] | null;
  sweetness: [number, number] | null;
  rest: (typeof REST_BUCKETS)[number] | null;
  minRating: number | null;               // 1–5, on the weighted rating
  minReviews: number | null;
  since: (typeof SINCE_OPTIONS)[number] | null;
  tested: boolean;                        // "Community Tested"
  have: string[];                         // aroma slugs the user owns → "recipes I can make"
  sort: Sort;
  view: 'grid' | 'list';
  page: number;
}

export const DEFAULT_FILTERS: RecipeFilters = {
  q: '', family: [], leaf: [], brand: [], origin: [], washed: null, sweetener: [], aromaBrand: [], flavour: [],
  profile: [], strength: null, intensity: null, sweetness: null, rest: null, minRating: null, minReviews: null,
  since: null, tested: false, have: [], sort: 'trending', view: 'grid', page: 1,
};

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

function get(raw: Raw, key: string): string[] {
  if (raw instanceof URLSearchParams) return raw.getAll(key).flatMap((v) => v.split(',')).filter(Boolean);
  const v = raw[key];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(',')).filter(Boolean);
}
const first = (raw: Raw, key: string) => get(raw, key)[0];
const slugList = (raw: Raw, key: string) =>
  [...new Set(get(raw, key).map((s) => s.toLowerCase().trim()).filter((s) => /^[a-z0-9][a-z0-9_-]{0,60}$/.test(s)))].slice(0, 20);
const intIn = (v: string | undefined, min: number, max: number): number | null => {
  if (v === undefined || !/^-?\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};
const range = (raw: Raw, key: string): [number, number] | null => {
  const v = first(raw, key);
  const m = v ? /^([1-5])-([1-5])$/.exec(v) : null;
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  return a <= b ? [a, b] : [b, a];
};
const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[]): T | null =>
  v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : null;

export function parseRecipeFilters(raw: Raw): RecipeFilters {
  return {
    q: (first(raw, 'q') ?? '').slice(0, 100).trim(),
    family: get(raw, 'family').filter((f) => (FAMILIES as readonly string[]).includes(f)),
    leaf: slugList(raw, 'leaf'),
    brand: slugList(raw, 'brand'),
    origin: get(raw, 'origin').map((s) => s.trim().slice(0, 60)).slice(0, 10),
    washed: oneOf(first(raw, 'washed'), ['yes', 'no'] as const),
    sweetener: get(raw, 'sweetener').filter((s) => (SWEETENER_CATEGORIES as readonly string[]).includes(s)),
    aromaBrand: slugList(raw, 'aromaBrand'),
    flavour: slugList(raw, 'flavour'),
    profile: slugList(raw, 'profile'),
    strength: range(raw, 'strength'),
    intensity: range(raw, 'intensity'),
    sweetness: range(raw, 'sweetness'),
    rest: oneOf(first(raw, 'rest'), REST_BUCKETS),
    minRating: intIn(first(raw, 'minRating'), 1, 5),
    minReviews: intIn(first(raw, 'minReviews'), 1, 500),
    since: oneOf(first(raw, 'since'), SINCE_OPTIONS),
    tested: first(raw, 'tested') === '1',
    have: slugList(raw, 'have'),
    sort: oneOf(first(raw, 'sort'), SORTS) ?? 'trending',
    view: first(raw, 'view') === 'list' ? 'list' : 'grid',
    page: intIn(first(raw, 'page'), 1, 10000) ?? 1,
  };
}

/** Only non-default values are emitted so shared URLs stay short and canonical (stable key order). */
export function serializeRecipeFilters(f: Partial<RecipeFilters>): string {
  const p = new URLSearchParams();
  const d = DEFAULT_FILTERS;
  const set = (k: string, v: string | number | null | undefined | string[]) => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  };
  set('q', f.q);
  set('family', f.family); set('leaf', f.leaf); set('brand', f.brand); set('origin', f.origin);
  set('washed', f.washed); set('sweetener', f.sweetener); set('aromaBrand', f.aromaBrand);
  set('flavour', f.flavour); set('profile', f.profile);
  if (f.strength) set('strength', `${f.strength[0]}-${f.strength[1]}`);
  if (f.intensity) set('intensity', `${f.intensity[0]}-${f.intensity[1]}`);
  if (f.sweetness) set('sweetness', `${f.sweetness[0]}-${f.sweetness[1]}`);
  set('rest', f.rest); set('minRating', f.minRating); set('minReviews', f.minReviews); set('since', f.since);
  if (f.tested) p.set('tested', '1');
  set('have', f.have);
  if (f.sort && f.sort !== d.sort) p.set('sort', f.sort);
  if (f.view && f.view !== d.view) p.set('view', f.view);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  return p.toString();
}

/** Number of active filters, excluding sort/view/page/q — shown on the mobile "Filters (3)" button. */
export function activeFilterCount(f: RecipeFilters): number {
  return [
    f.family.length, f.leaf.length, f.brand.length, f.origin.length, f.washed ? 1 : 0, f.sweetener.length,
    f.aromaBrand.length, f.flavour.length, f.profile.length, f.strength ? 1 : 0, f.intensity ? 1 : 0,
    f.sweetness ? 1 : 0, f.rest ? 1 : 0, f.minRating ? 1 : 0, f.minReviews ? 1 : 0, f.since ? 1 : 0,
    f.tested ? 1 : 0, f.have.length ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

/** Resting-time bucket → inclusive hour range. */
export function restBucketHours(b: (typeof REST_BUCKETS)[number]): { min: number | null; max: number | null } {
  switch (b) {
    case 'lt24': return { min: null, max: 23 };
    case '24-72': return { min: 24, max: 72 };
    case '72-168': return { min: 73, max: 168 };
    case 'gt168': return { min: 169, max: null };
  }
}

export function sinceToDate(s: (typeof SINCE_OPTIONS)[number], now = new Date()): Date {
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[s];
  return new Date(now.getTime() - days * 86400000);
}
