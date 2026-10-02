import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleRecipe, gramsToMl, mlToGrams, formatAmount, toGrams, fromGrams } from './scaler.ts';

const near = (a: number | null, b: number, eps = 1e-9) => {
  assert.ok(a !== null && Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
};

const sample = {
  tobacco_weight_g: 100,
  base: [
    { id: 'vg', category: 'vegetable_glycerin' as const, name: 'VG', weight_g: 35 },
    { id: 'hn', category: 'honey' as const, name: 'Honey', weight_g: 10 },
    { id: 'w', category: 'water' as const, name: 'Water', weight_g: 5 },
  ],
  aromas: [
    { id: 'a1', flavour_name: 'Blueberry', weight_g: 6, role: 'primary' },
    { id: 'a2', flavour_name: 'Mint', weight_g: 1, role: 'cooling' },
  ],
  batch_weight_g: 157,
};

test('scaling 157 g → 314 g doubles every absolute quantity', () => {
  const r = scaleRecipe(sample, 314);
  near(r.factor, 2);
  const byId = Object.fromEntries(r.rows.map((x) => [x.id, x]));
  near(byId.tobacco.weight_g, 200);
  near(byId.vg.weight_g, 70);
  near(byId.hn.weight_g, 20);
  near(byId.a1.weight_g, 12);
  near(byId.a2.weight_g, 2);
});

test('percentages are invariant under scaling', () => {
  const a = scaleRecipe(sample);
  const b = scaleRecipe(sample, 1000);
  for (let i = 0; i < a.rows.length; i++) near(a.rows[i].pct_of_batch, b.rows[i].pct_of_batch!);
  near(a.composition.aroma_pct, b.composition.aroma_pct);
});

test('composition buckets: tobacco / glycerin / sweetener / aroma / other', () => {
  const r = scaleRecipe(sample);
  near(r.composition.tobacco_pct, (100 / 157) * 100);
  near(r.composition.glycerin_pct, (35 / 157) * 100);
  near(r.composition.sweetener_pct, (10 / 157) * 100);
  near(r.composition.aroma_pct, (7 / 157) * 100);
  near(r.composition.other_liquid_pct, (5 / 157) * 100);
  near(r.composition.accounted_for_pct, 100);
  assert.equal(r.warnings.length, 0);
});

test('ratios', () => {
  const r = scaleRecipe(sample);
  near(r.ratios.tobacco_to_wet, 57 / 100);         // wet : tobacco = 0.57 → "1 : 0.57"
  near(r.ratios.vg_to_sweetener, 3.5);
  near(r.ratios.flavour_load_pct, (7 / 157) * 100);
});

test('no sweetener → VG:sweetener ratio is null (never Infinity)', () => {
  const r = scaleRecipe({ ...sample, base: [sample.base[0]], batch_weight_g: null });
  assert.equal(r.ratios.vg_to_sweetener, null);
});

test('batch weight is derived when missing, with a warning', () => {
  const r = scaleRecipe({ ...sample, batch_weight_g: null });
  near(r.original_batch_g, 157);
  assert.ok(r.warnings.some((w) => /computed/i.test(w)));
});

test('aromas recorded only as % of batch are solved against the batch', () => {
  // 100 tobacco + 40 liquids, aromas 4% + 1% of the finished batch → batch = 140 / 0.95
  const r = scaleRecipe({
    tobacco_weight_g: 100,
    base: [{ id: 'vg', category: 'vegetable_glycerin', name: 'VG', weight_g: 40 }],
    aromas: [
      { id: 'a', flavour_name: 'Blueberry', pct_of_batch: 4, role: 'primary' },
      { id: 'b', flavour_name: 'Vanilla', pct_of_batch: 1, role: 'secondary' },
    ],
  });
  near(r.original_batch_g, 140 / 0.95);
  near(r.composition.aroma_pct, 5);
  near(r.composition.accounted_for_pct, 100);
  const doubled = scaleRecipe({
    tobacco_weight_g: 100,
    base: [{ id: 'vg', category: 'vegetable_glycerin', name: 'VG', weight_g: 40 }],
    aromas: [{ id: 'a', flavour_name: 'Blueberry', pct_of_batch: 4, role: 'primary' }, { id: 'b', flavour_name: 'Vanilla', pct_of_batch: 1, role: 'secondary' }],
  }, 2 * (140 / 0.95));
  near(doubled.rows.find((x) => x.id === 'a')!.weight_g, 2 * 0.04 * (140 / 0.95));
});

test('volume-only rows are NOT silently converted to grams', () => {
  const r = scaleRecipe({
    ...sample,
    base: [...sample.base, { id: 'x', category: 'other' as const, name: 'Mystery syrup', volume_ml: 10 }],
  });
  const row = r.rows.find((x) => x.id === 'x')!;
  assert.equal(row.weight_g, null);
  assert.equal(row.pct_of_batch, null);
  assert.equal(row.basis, 'unknown');
  assert.ok(row.note);
  near(row.volume_ml, 10);
  assert.equal(r.has_unconvertible, true);
  // …but the volume itself still scales linearly
  near(scaleRecipe({ ...sample, base: [...sample.base, { id: 'x', category: 'other' as const, name: 'Mystery syrup', volume_ml: 10 }] }, 314).rows.find((x) => x.id === 'x')!.volume_ml, 20);
});

test('volume + explicit density is converted, and marked as derived', () => {
  const r = scaleRecipe({
    tobacco_weight_g: 100,
    base: [{ id: 'vg', category: 'vegetable_glycerin', name: 'VG', volume_ml: 30, density_g_per_ml: 1.26 }],
    aromas: [{ id: 'a', flavour_name: 'Apple', weight_g: 6, role: 'primary' }],
  });
  const row = r.rows.find((x) => x.id === 'vg')!;
  near(row.weight_g, 37.8);
  assert.equal(row.basis, 'derived_from_density');
});

test('density helpers return null without density', () => {
  assert.equal(gramsToMl(10, null), null);
  assert.equal(gramsToMl(10, 0), null);
  assert.equal(mlToGrams(10, undefined), null);
  near(gramsToMl(12.6, 1.26), 10);
  near(mlToGrams(10, 1.26), 12.6);
});

test('invalid inputs throw', () => {
  assert.throws(() => scaleRecipe({ ...sample, tobacco_weight_g: 0 }), RangeError);
  assert.throws(() => scaleRecipe({
    tobacco_weight_g: 100, base: [],
    aromas: [{ id: 'a', flavour_name: 'x', pct_of_batch: 100, role: 'primary' }],
  }), RangeError);
});

test('unit conversions round-trip', () => {
  near(fromGrams(toGrams(250, 'oz'), 'oz'), 250);
  near(toGrams(1, 'lb'), 453.59237);
});

test('formatAmount precision by magnitude', () => {
  assert.equal(formatAmount(0.4567), '0.457 g');
  assert.equal(formatAmount(4.567), '4.57 g');
  assert.equal(formatAmount(45.67), '45.7 g');
  assert.equal(formatAmount(456.7), '457 g');
  assert.equal(formatAmount(null), '—');
});
