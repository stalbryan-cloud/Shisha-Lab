import { describe, expect, it } from 'vitest';
import { aromaSchema, baseIngredientSchema, recipeDraftSchema, sourceSchema } from '@/lib/validators/recipe';
import { reportSchema, signupSchema, usernameSchema } from '@/lib/validators/community';
import { zodFieldErrors } from '@/lib/actions/result';

describe('recipe validators', () => {
  it('requires a weight or volume for base ingredients', () => {
    expect(baseIngredientSchema.safeParse({ category: 'honey', name: 'Honey' }).success).toBe(false);
    expect(baseIngredientSchema.safeParse({ category: 'honey', name: 'Honey', weight_g: '12.5' }).success).toBe(true);
  });
  it('accepts percentage-only aromas and rejects empty ones', () => {
    expect(aromaSchema.safeParse({ flavour_name: 'Peach', pct_of_batch: '4' }).success).toBe(true);
    expect(aromaSchema.safeParse({ flavour_name: 'Peach' }).success).toBe(false);
  });
  it('rejects javascript: URLs in sources', () => {
    expect(sourceSchema.safeParse({ title: 'x', source_type: 'website', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(sourceSchema.safeParse({ title: 'x', source_type: 'website', url: 'https://example.org/thread' }).success).toBe(true);
  });
  it('allows a blank draft so autosave can start immediately', () => {
    expect(recipeDraftSchema.safeParse({}).success).toBe(true);
  });
  it('reports nested errors by dotted path', () => {
    const r = recipeDraftSchema.safeParse({ aromas: [{ flavour_name: '' }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(zodFieldErrors(r.error)).some((k) => k.startsWith('aromas.0'))).toBe(true);
  });
});

describe('community validators', () => {
  it('normalises and validates usernames', () => {
    expect(usernameSchema.parse('  Lab_Rat  ')).toBe('lab_rat');
    expect(usernameSchema.safeParse('no spaces').success).toBe(false);
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });
  it('signup needs age and rules acknowledgement', () => {
    const base = { email: 'a@b.co', password: 'longenoughpass', username: 'alice' };
    expect(signupSchema.safeParse(base).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, age_ack: 'on', rules_ack: 'on' }).success).toBe(true);
  });
  it('report reasons are a closed list', () => {
    expect(reportSchema.safeParse({ target_type: 'recipe', target_id: crypto.randomUUID(), reason: 'because' }).success).toBe(false);
    expect(reportSchema.safeParse({ target_type: 'recipe', target_id: crypto.randomUUID(), reason: 'tobacco_sales' }).success).toBe(true);
  });
});
