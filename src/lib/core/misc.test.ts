import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBadges } from './badges.ts';
import { completeness, publishBlockers } from './completeness.ts';

const base = { made_count: 0, completeness: 0, review_count: 0, bayes_rating: 0, like_count: 0, save_count: 0, is_featured: false,
  version_major: 1, version_minor: 0, updated_at: new Date() };

test('badges describe evidence only', () => {
  assert.deepEqual(computeBadges(base), []);
  assert.ok(computeBadges({ ...base, made_count: 3 }).includes('community_tested'));
  const many = computeBadges({ ...base, made_count: 12 });
  assert.ok(many.includes('frequently_made') && !many.includes('community_tested'));
  assert.ok(computeBadges({ ...base, review_count: 5, bayes_rating: 4.3 }).includes('highly_rated'));
  assert.ok(!computeBadges({ ...base, review_count: 2, bayes_rating: 4.9 }).includes('highly_rated'));
  assert.ok(computeBadges({ ...base, version_minor: 1 }).includes('updated_recently'));
  assert.ok(!computeBadges({ ...base, version_minor: 1, updated_at: new Date(Date.now() - 90 * 86400000) }).includes('updated_recently'));
  // never claims safety / verification
  for (const b of computeBadges({ ...base, made_count: 50, review_count: 50, bayes_rating: 5, completeness: 100, is_featured: true })) {
    assert.ok(!/verified|safe|certified/i.test(b));
  }
});

test('publish blockers list the minimum dataset', () => {
  const empty = { base_count: 0, aroma_count: 0, step_count: 0, has_characteristics: false, profile_count: 0, source_count: 0 };
  assert.equal(publishBlockers(empty).length, 4);
  const ok = { ...empty, title: 'Blueberry mix', tobacco_weight: 100, aroma_count: 1, step_count: 1 };
  assert.deepEqual(publishBlockers(ok), []);
});

test('completeness is bounded and monotonic', () => {
  const empty = completeness({ base_count: 0, aroma_count: 0, step_count: 0, has_characteristics: false, profile_count: 0, source_count: 0 });
  assert.equal(empty.score, 0);
  const more = completeness({ title: 'x y z', tobacco_weight: 100, base_count: 1, aroma_count: 2, step_count: 3, has_characteristics: true, profile_count: 1, source_count: 1 });
  assert.ok(more.score > 40 && more.score < 100);
  assert.ok(more.hints.length <= 3);
});
