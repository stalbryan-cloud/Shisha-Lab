import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bayesianAverage, wilsonLowerBound, mean, distributionRows, summariseExperiments, hasEnoughRatings } from './ratings.ts';

test('a single 5★ does not beat hundreds of 4.8★ (Bayesian)', () => {
  const site = 3.9;
  const single = bayesianAverage(5, 1, site);
  const many = bayesianAverage(4.8, 300, site);
  assert.ok(many > single, `${many} should beat ${single}`);
});

test('Bayesian average converges to the raw mean for large samples', () => {
  const v = bayesianAverage(4.2, 100000, 3.5);
  assert.ok(Math.abs(v - 4.2) < 0.001);
});

test('Wilson lower bound penalises tiny samples', () => {
  assert.ok(wilsonLowerBound(1, 1) < wilsonLowerBound(90, 100));
  assert.equal(wilsonLowerBound(0, 0), 0);
});

test('mean and distribution rows', () => {
  assert.equal(mean([0, 0, 0, 0, 0]), null);
  assert.equal(mean([0, 0, 0, 1, 1]), 4.5);
  const rows = distributionRows([1, 0, 0, 1, 2]);
  assert.deepEqual(rows.map((r) => r.stars), [5, 4, 3, 2, 1]);
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].pct, 50);
});

test('experiment stats are withheld for small samples', () => {
  const two = summariseExperiments([
    { overall: 5, would_make_again: 'yes', followed_exactly: true },
    { overall: 4, would_make_again: 'yes', followed_exactly: false },
  ]);
  assert.equal(two.enough, false);
  assert.equal(two.avgOverall, null);
  const three = summariseExperiments([
    { overall: 5, would_make_again: 'yes', followed_exactly: true },
    { overall: 4, would_make_again: 'maybe', followed_exactly: false },
    { overall: 3, would_make_again: 'no', followed_exactly: true },
  ]);
  assert.equal(three.enough, true);
  assert.equal(three.avgOverall, 4);
  assert.ok(Math.abs((three.makeAgainPct ?? 0) - 100 / 3) < 1e-9);
});

test('enough-ratings threshold', () => {
  assert.equal(hasEnoughRatings(2), false);
  assert.equal(hasEnoughRatings(3), true);
});
