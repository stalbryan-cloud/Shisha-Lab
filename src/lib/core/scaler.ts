/**
 * Recipe scaling and composition maths. Dependency-free so it can run on server, client and in tests.
 *
 * Rules (from the product spec):
 *  - mass and volume scale linearly with the target batch weight;
 *  - mass is NEVER converted to volume (or back) unless the ingredient carries an explicit density;
 *  - anything that cannot be reliably converted is flagged, never guessed;
 *  - no "correct" ratio is assumed — we only report what the recipe contains.
 */

export type BaseCategory =
  | 'vegetable_glycerin' | 'honey' | 'molasses' | 'invert_syrup'
  | 'glucose_syrup' | 'propylene_glycol' | 'water' | 'other';

export interface BaseIngredientInput {
  id: string;
  category: BaseCategory;
  name: string;
  brand?: string | null;
  weight_g?: number | null;
  volume_ml?: number | null;
  /** Only used to derive mass from a volume-only row. Never assumed from the category. */
  density_g_per_ml?: number | null;
  notes?: string | null;
}

export interface AromaInput {
  id: string;
  flavour_name: string;
  brand?: string | null;
  concentrate_name?: string | null;
  weight_g?: number | null;
  volume_ml?: number | null;
  /** Percentage of the finished batch, if the author recorded it. */
  pct_of_batch?: number | null;
  manufacturer_recommended_pct?: number | null;
  role: string;
}

export interface ScalerInput {
  /** Dry tobacco weight in grams. */
  tobacco_weight_g: number;
  base: BaseIngredientInput[];
  aromas: AromaInput[];
  /** Finished batch weight in grams. If omitted, computed from the components. */
  batch_weight_g?: number | null;
}

export type MassBasis = 'recorded' | 'derived_from_percentage' | 'derived_from_density' | 'unknown';

export interface ScaledRow {
  id: string;
  kind: 'tobacco' | 'base' | 'aroma';
  category: BaseCategory | 'tobacco' | 'aroma';
  name: string;
  brand?: string | null;
  role?: string;
  weight_g: number | null;
  volume_ml: number | null;
  /** Percentage of the finished batch by mass; null when the row has no reliable mass. */
  pct_of_batch: number | null;
  /** Percentage of dry tobacco by mass. */
  pct_of_tobacco: number | null;
  basis: MassBasis;
  /** Human-readable reason when mass or volume can't be reliably provided. */
  note?: string;
}

export interface Composition {
  tobacco_pct: number;
  glycerin_pct: number;
  sweetener_pct: number;
  aroma_pct: number;
  other_liquid_pct: number;
  /** Mass-sum / batch mass; < 1 or > 1 flags rows that don't add up. */
  accounted_for_pct: number;
}

export interface Ratios {
  /** dry tobacco : everything else, as "1 : x". null when there is no wet mass. */
  tobacco_to_wet: number | null;
  /** vegetable glycerin : sweetener (as VG ÷ sweetener). null when sweetener is zero/absent. */
  vg_to_sweetener: number | null;
  /** total aroma load, % of batch (same as composition.aroma_pct). */
  flavour_load_pct: number;
}

export interface ScaledRecipe {
  factor: number;
  original_batch_g: number;
  target_batch_g: number;
  rows: ScaledRow[];
  composition: Composition;
  ratios: Ratios;
  /** True if any row has no reliable mass, so percentages are approximate. */
  has_unconvertible: boolean;
  warnings: string[];
}

const SWEETENERS: BaseCategory[] = ['honey', 'molasses', 'invert_syrup', 'glucose_syrup'];

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const pos = (n: unknown): n is number => finite(n) && n > 0;

interface Resolved {
  weight: number | null;
  basis: MassBasis;
  note?: string;
}

function resolveBaseMass(i: BaseIngredientInput): Resolved {
  if (finite(i.weight_g) && i.weight_g >= 0) return { weight: i.weight_g, basis: 'recorded' };
  if (finite(i.volume_ml) && pos(i.density_g_per_ml)) {
    return { weight: i.volume_ml * i.density_g_per_ml, basis: 'derived_from_density' };
  }
  if (finite(i.volume_ml)) {
    return { weight: null, basis: 'unknown', note: 'Volume only and no density recorded — cannot convert to grams reliably.' };
  }
  return { weight: null, basis: 'unknown', note: 'No amount recorded.' };
}

/** Mass of one aroma row. Weight first; otherwise the author's % of batch; otherwise density; otherwise unknown. */
function resolveAromaMass(a: AromaInput, batch: number | null): Resolved {
  if (finite(a.weight_g) && a.weight_g >= 0) return { weight: a.weight_g, basis: 'recorded' };
  if (finite(a.pct_of_batch) && batch !== null && batch > 0) {
    return { weight: (a.pct_of_batch / 100) * batch, basis: 'derived_from_percentage' };
  }
  if (finite(a.volume_ml)) {
    return { weight: null, basis: 'unknown', note: 'Volume only and no density recorded — cannot convert to grams reliably.' };
  }
  return { weight: null, basis: 'unknown', note: 'No amount recorded.' };
}

/** Mass of everything we can account for; used to derive a batch weight when none is recorded. */
function sumKnownMass(input: ScalerInput): number {
  let sum = input.tobacco_weight_g;
  for (const b of input.base) {
    const r = resolveBaseMass(b);
    if (r.weight !== null) sum += r.weight;
  }
  for (const a of input.aromas) {
    if (finite(a.weight_g)) sum += a.weight_g;
  }
  return sum;
}

/**
 * Compute composition and scaled quantities for `targetBatchG`. With no target (or target = original) this is the
 * recipe as written.
 */
export function scaleRecipe(input: ScalerInput, targetBatchG?: number | null): ScaledRecipe {
  if (!pos(input.tobacco_weight_g)) throw new RangeError('tobacco_weight_g must be a positive number');
  const warnings: string[] = [];

  // Original batch mass: recorded, else the sum of what's known. Aromas that only have a % are added on top
  // afterwards (their % refers to the finished batch, so we solve batch = known / (1 − Σpct)).
  let batch = pos(input.batch_weight_g) ? input.batch_weight_g : null;
  if (batch === null) {
    const known = sumKnownMass(input);
    const pctOnly = input.aromas
      .filter((a) => !finite(a.weight_g) && finite(a.pct_of_batch))
      .reduce((s, a) => s + (a.pct_of_batch as number), 0);
    if (pctOnly >= 100) throw new RangeError('Aroma percentages add up to 100% or more');
    batch = known / (1 - pctOnly / 100);
    warnings.push('No finished batch weight recorded; computed from the listed amounts.');
  }
  const original = batch;
  const target = pos(targetBatchG) ? targetBatchG : original;
  if (!pos(original)) throw new RangeError('Original batch weight must be positive');
  const factor = target / original;

  const rows: ScaledRow[] = [];
  const mk = (r: Omit<ScaledRow, 'pct_of_batch' | 'pct_of_tobacco'> & { origWeight: number | null }): ScaledRow => {
    const { origWeight, ...rest } = r;
    return {
      ...rest,
      pct_of_batch: origWeight === null ? null : (origWeight / original) * 100,
      pct_of_tobacco: origWeight === null ? null : (origWeight / input.tobacco_weight_g) * 100,
    };
  };

  rows.push(mk({
    id: 'tobacco', kind: 'tobacco', category: 'tobacco', name: 'Dry tobacco',
    weight_g: input.tobacco_weight_g * factor, volume_ml: null, basis: 'recorded',
    origWeight: input.tobacco_weight_g,
  }));

  for (const b of input.base) {
    const m = resolveBaseMass(b);
    rows.push(mk({
      id: b.id, kind: 'base', category: b.category, name: b.name, brand: b.brand,
      weight_g: m.weight === null ? null : m.weight * factor,
      volume_ml: finite(b.volume_ml) ? b.volume_ml * factor : null,
      basis: m.basis, note: m.note, origWeight: m.weight,
    }));
  }

  for (const a of input.aromas) {
    const m = resolveAromaMass(a, original);
    rows.push(mk({
      id: a.id, kind: 'aroma', category: 'aroma',
      name: a.concentrate_name ? `${a.flavour_name} — ${a.concentrate_name}` : a.flavour_name,
      brand: a.brand, role: a.role,
      weight_g: m.weight === null ? null : m.weight * factor,
      volume_ml: finite(a.volume_ml) ? a.volume_ml * factor : null,
      basis: m.basis, note: m.note, origWeight: m.weight,
    }));
  }

  const sumPct = (pred: (r: ScaledRow) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + (r.pct_of_batch ?? 0), 0);

  const composition: Composition = {
    tobacco_pct: sumPct((r) => r.kind === 'tobacco'),
    glycerin_pct: sumPct((r) => r.kind === 'base' && r.category === 'vegetable_glycerin'),
    sweetener_pct: sumPct((r) => r.kind === 'base' && SWEETENERS.includes(r.category as BaseCategory)),
    aroma_pct: sumPct((r) => r.kind === 'aroma'),
    other_liquid_pct: sumPct((r) =>
      r.kind === 'base' && !SWEETENERS.includes(r.category as BaseCategory) && r.category !== 'vegetable_glycerin'),
    accounted_for_pct: sumPct(() => true),
  };

  const wetPct = composition.accounted_for_pct - composition.tobacco_pct;
  const vg = composition.glycerin_pct;
  const sw = composition.sweetener_pct;
  const ratios: Ratios = {
    tobacco_to_wet: wetPct > 0 ? wetPct / composition.tobacco_pct : null,
    vg_to_sweetener: sw > 0 ? vg / sw : null,
    flavour_load_pct: composition.aroma_pct,
  };

  const hasUnconvertible = rows.some((r) => r.basis === 'unknown');
  if (hasUnconvertible) {
    warnings.push('Some amounts could not be converted to grams, so the percentages shown are approximate.');
  }
  if (Math.abs(composition.accounted_for_pct - 100) > 1.5 && !hasUnconvertible) {
    warnings.push(`Listed amounts account for ${composition.accounted_for_pct.toFixed(1)}% of the recorded batch weight.`);
  }

  return { factor, original_batch_g: original, target_batch_g: target, rows, composition, ratios, has_unconvertible: hasUnconvertible, warnings };
}

/** Explicit, density-based conversion helpers. Both return null without a valid density — never guess. */
export function gramsToMl(g: number, densityGPerMl?: number | null): number | null {
  return pos(densityGPerMl) && finite(g) ? g / densityGPerMl : null;
}
export function mlToGrams(ml: number, densityGPerMl?: number | null): number | null {
  return pos(densityGPerMl) && finite(ml) ? ml * densityGPerMl : null;
}

const TO_GRAMS = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 } as const;
export type WeightUnit = keyof typeof TO_GRAMS;
export const toGrams = (value: number, unit: WeightUnit) => value * TO_GRAMS[unit];
export const fromGrams = (grams: number, unit: WeightUnit) => grams / TO_GRAMS[unit];

/** Display rounding: sensible precision by magnitude (0.01 g for aroma-sized amounts, 0.1 g above 10 g). */
export function formatAmount(n: number | null, unit = 'g'): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const digits = abs < 1 ? 3 : abs < 10 ? 2 : abs < 100 ? 1 : 0;
  const s = Number(n.toFixed(digits)).toString();
  return `${s} ${unit}`;
}
export function formatPct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${Number(n.toFixed(digits))}%`;
}
