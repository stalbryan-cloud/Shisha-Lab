import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipeFilters, serializeRecipeFilters, DEFAULT_FILTERS, activeFilterCount, restBucketHours } from './filters.ts';

test('empty URL gives defaults and serialises back to empty', () => {
  const f = parseRecipeFilters({});
  assert.deepEqual(f, DEFAULT_FILTERS);
  assert.equal(serializeRecipeFilters(f), '');
});

test('round trip is stable', () => {
  const qs = 'q=blueberry&family=dark&flavour=blueberry,vanilla&washed=yes&strength=3-5&minRating=4&tested=1&sort=rating&view=list&page=2';
  const f = parseRecipeFilters(new URLSearchParams(qs));
  assert.deepEqual(f.flavour, ['blueberry', 'vanilla']);
  assert.deepEqual(f.strength, [3, 5]);
  assert.equal(f.tested, true);
  const again = parseRecipeFilters(new URLSearchParams(serializeRecipeFilters(f)));
  assert.deepEqual(again, f);
});

test('hostile / malformed input is clamped, never thrown', () => {
  const f = parseRecipeFilters({
    q: 'x'.repeat(500), family: ['dark', '<script>'], sort: 'DROP TABLE', page: '-5', minRating: '99',
    strength: '5-1', flavour: "a'; drop table--,ok-slug", view: 'weird', washed: 'maybe',
  });
  assert.equal(f.q.length, 100);
  assert.deepEqual(f.family, ['dark']);
  assert.equal(f.sort, 'trending');
  assert.equal(f.page, 1);
  assert.equal(f.minRating, null);
  assert.deepEqual(f.strength, [1, 5]);
  assert.deepEqual(f.flavour, ['ok-slug']);
  assert.equal(f.view, 'grid');
  assert.equal(f.washed, null);
});

test('array-valued Next.js searchParams are accepted', () => {
  const f = parseRecipeFilters({ flavour: ['mint', 'lemon'], family: 'blonde' });
  assert.deepEqual(f.flavour, ['mint', 'lemon']);
  assert.deepEqual(f.family, ['blonde']);
});

test('active filter count ignores sort/view/page/query', () => {
  const f = parseRecipeFilters(new URLSearchParams('q=x&sort=newest&view=list&page=3&family=dark&flavour=mint,lemon&tested=1'));
  assert.equal(activeFilterCount(f), 4);
});

test('rest buckets', () => {
  assert.deepEqual(restBucketHours('lt24'), { min: null, max: 23 });
  assert.deepEqual(restBucketHours('gt168'), { min: 169, max: null });
});
