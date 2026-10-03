// Pure helpers for the "jar" visual: every flavour gets a stable, readable colour.
// All tints are light enough for the dark ink colour (#14213D) to stay legible on top of them.

const KEYWORD_TINTS: [string, string][] = [
  ['blueberry', '#9db4f0'], ['blackcurrant', '#b7a2da'], ['cassis', '#b7a2da'], ['grape', '#c6a8e2'],
  ['apple', '#bfe08a'], ['lemon', '#f5e27b'], ['lime', '#cfe88c'], ['orange', '#f6b86f'], ['peach', '#f7c1a2'],
  ['mango', '#f7c95f'], ['watermelon', '#f5a0a8'], ['strawberry', '#f39099'], ['raspberry', '#ee8ea6'],
  ['pineapple', '#f2da6c'], ['cherry', '#e98a9a'], ['banana', '#f4e08a'], ['coconut', '#efe8da'],
  ['vanilla', '#f3e7c4'], ['cream', '#f6efe2'], ['caramel', '#dba968'], ['coffee', '#b88f72'],
  ['cinnamon', '#d28c5e'], ['chocolate', '#b99580'], ['honey', '#f0c978'],
  ['menthol', '#a9dde9'], ['mint', '#9bdcc1'], ['rose', '#f2b4d0'], ['jasmine', '#f4e6ef'], ['tea', '#cdb98f'],
];

/** Light, stable tint for a flavour name. Unknown names get a deterministic pastel from a hash of the name. */
export function flavourTint(name: string): string {
  const n = name.toLowerCase();
  for (const [key, hex] of KEYWORD_TINTS) if (n.includes(key)) return hex;
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 48% 78%)`;
}

export interface JarBand {
  name: string;
  pct: number | null;
  color: string;
  /** Relative height weight, never below a readable minimum. */
  weight: number;
}

/** Turns a recipe's aromas into stacked bands. Order is the recipe's own order (top to bottom). */
export function jarBands(aromas: { flavour_name: string; pct_of_batch: number | null }[]): JarBand[] {
  const known = aromas.filter((a) => a.flavour_name);
  if (!known.length) return [];
  const total = known.reduce((s, a) => s + (a.pct_of_batch && a.pct_of_batch > 0 ? a.pct_of_batch : 0), 0);
  return known.map((a) => {
    const pct = a.pct_of_batch && a.pct_of_batch > 0 ? a.pct_of_batch : null;
    const share = total > 0 && pct ? pct / total : 1 / known.length;
    return { name: a.flavour_name, pct, color: flavourTint(a.flavour_name), weight: Math.max(share, 0.14) };
  });
}

/** Total aroma load as shown in the label, e.g. "6%" or "5.5%". Null when no percentages are known. */
export function totalAromaPct(aromas: { pct_of_batch: number | null }[]): string | null {
  const t = aromas.reduce((s, a) => s + (a.pct_of_batch && a.pct_of_batch > 0 ? a.pct_of_batch : 0), 0);
  if (t <= 0) return null;
  return `${Number.isInteger(t) ? t : t.toFixed(1).replace(/\.0$/, '')}%`;
}
