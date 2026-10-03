import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flavourTint, jarBands, totalAromaPct } from './flavour-colors.ts';

test('known flavours get their fixed tint, unknown ones a stable pastel', () => {
  assert.equal(flavourTint('Blueberry'), '#9db4f0');
  assert.equal(flavourTint('Wild blueberry jam'), '#9db4f0');
  assert.equal(flavourTint('Dragonfruit'), flavourTint('dragonfruit'));
  assert.match(flavourTint('Dragonfruit'), /^hsl\(\d+ 48% 78%\)$/);
});

test('bands follow recipe order and heights follow percentages', () => {
  const bands = jarBands([
    { flavour_name: 'Blueberry', pct_of_batch: 4 },
    { flavour_name: 'Vanilla', pct_of_batch: 1.5 },
    { flavour_name: 'Mint', pct_of_batch: 0.5 },
  ]);
  assert.deepEqual(bands.map((b) => b.name), ['Blueberry', 'Vanilla', 'Mint']);
  assert.ok(bands[0].weight > bands[1].weight && bands[1].weight > bands[2].weight);
  assert.ok(bands.every((b) => b.weight >= 0.14), 'tiny aromas stay readable');
});

test('missing percentages fall back to equal bands, no aromas gives no bands', () => {
  const bands = jarBands([{ flavour_name: 'Apple', pct_of_batch: null }, { flavour_name: 'Grape', pct_of_batch: null }]);
  assert.equal(bands.length, 2);
  assert.equal(bands[0].weight, bands[1].weight);
  assert.deepEqual(jarBands([]), []);
});

test('total aroma load is formatted compactly', () => {
  assert.equal(totalAromaPct([{ pct_of_batch: 4 }, { pct_of_batch: 2 }]), '6%');
  assert.equal(totalAromaPct([{ pct_of_batch: 4 }, { pct_of_batch: 1.5 }]), '5.5%');
  assert.equal(totalAromaPct([{ pct_of_batch: null }]), null);
});
