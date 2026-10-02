/** Rating maths shared by UI and tests. The database applies the same Bayesian formula (see 0002 migration). */

export type Distribution = [number, number, number, number, number]; // index 0 = 1★ … index 4 = 5★

export const MIN_REVIEWS_TO_RANK = 3;      // below this a recipe is shown "New / not enough ratings"
export const MIN_EXPERIMENTS_FOR_STATS = 3; // below this, "made this" aggregates are hidden
export const BAYES_PRIOR_WEIGHT = 8;       // m in the formula; keep in sync with SQL

export function count(dist: number[]): number {
  return dist.reduce((a, b) => a + b, 0);
}

export function mean(dist: number[]): number | null {
  const n = count(dist);
  if (n === 0) return null;
  return dist.reduce((s, c, i) => s + c * (i + 1), 0) / n;
}

/** (v·R + m·C) / (v + m). One 5★ can't outrank many 4.8s because C pulls small samples toward the site mean. */
export function bayesianAverage(avg: number, votes: number, siteMean: number, m = BAYES_PRIOR_WEIGHT): number {
  if (votes <= 0) return siteMean;
  return (votes * avg + m * siteMean) / (votes + m);
}

/** Lower bound of the Wilson score interval treating ratings ≥4★ as "positive" (z = 1.96 ≈ 95%). */
export function wilsonLowerBound(positive: number, total: number, z = 1.96): number {
  if (total === 0) return 0;
  const p = positive / total;
  const z2 = z * z;
  return (p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / (1 + z2 / total);
}

/** Percentages for the 5-bar histogram, highest rating first (5★ … 1★). */
export function distributionRows(dist: number[]): { stars: number; count: number; pct: number }[] {
  const n = count(dist);
  return [5, 4, 3, 2, 1].map((stars) => {
    const c = dist[stars - 1] ?? 0;
    return { stars, count: c, pct: n === 0 ? 0 : (c / n) * 100 };
  });
}

export function hasEnoughRatings(n: number): boolean {
  return n >= MIN_REVIEWS_TO_RANK;
}

export interface ExperimentSummary {
  total: number;
  enough: boolean;
  avgOverall: number | null;
  makeAgainPct: number | null;
  exactPct: number | null;
}

/** Summarise "I made this" reports; hides statistics when the sample is too small to mean anything. */
export function summariseExperiments(
  rows: { overall: number; would_make_again: 'yes' | 'maybe' | 'no'; followed_exactly: boolean }[],
): ExperimentSummary {
  const total = rows.length;
  const enough = total >= MIN_EXPERIMENTS_FOR_STATS;
  if (!enough) return { total, enough, avgOverall: null, makeAgainPct: null, exactPct: null };
  return {
    total,
    enough,
    avgOverall: rows.reduce((s, r) => s + r.overall, 0) / total,
    makeAgainPct: (rows.filter((r) => r.would_make_again === 'yes').length / total) * 100,
    exactPct: (rows.filter((r) => r.followed_exactly).length / total) * 100,
  };
}

/** Group free-form modification descriptions by kind for the "common modifications" panel. */
export function commonModifications(changes: { kind: string }[], limit = 4): { kind: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of changes) m.set(c.kind, (m.get(c.kind) ?? 0) + 1);
  return [...m.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
