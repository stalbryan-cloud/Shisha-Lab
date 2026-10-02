/** Completeness meter for the recipe wizard: encourages detail without forcing it. Returns 0–100 and hints. */
export interface CompletenessInput {
  title?: string | null; short_description?: string | null; cover_image_path?: string | null;
  target_batch_weight?: number | null; tobacco_weight?: number | null; tobacco_leaf_family?: string | null;
  tobacco_origin?: string | null; tobacco_brand?: string | null; washed?: boolean | null;
  base_count: number; aroma_count: number; step_count: number;
  initial_rest_hours?: number | null; recommended_rest_hours?: number | null; storage_method?: string | null;
  has_characteristics: boolean; profile_count: number; source_count: number; creator_notes?: string | null;
}
const filled = (v: unknown) => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v));

export const MIN_PUBLISH = [
  { key: 'title', label: 'A title' },
  { key: 'tobacco', label: 'Tobacco weight or description' },
  { key: 'aromas', label: 'At least one aroma' },
  { key: 'steps', label: 'At least one process step' },
] as const;

export function publishBlockers(i: CompletenessInput): string[] {
  const out: string[] = [];
  if (!filled(i.title) || String(i.title).trim().length < 3) out.push('Add a title (3+ characters).');
  if (!filled(i.tobacco_weight) && !filled(i.tobacco_leaf_family)) out.push('Describe the tobacco (weight or leaf family).');
  if (i.aroma_count < 1) out.push('Add at least one aroma.');
  if (i.step_count < 1) out.push('Add at least one process step.');
  return out;
}

export function completeness(i: CompletenessInput): { score: number; hints: string[] } {
  const checks: [boolean, number, string][] = [
    [filled(i.title), 5, 'Add a title'],
    [filled(i.short_description), 5, 'Add a short description'],
    [filled(i.cover_image_path), 8, 'Add a cover photo'],
    [filled(i.target_batch_weight), 6, 'Record the batch size'],
    [filled(i.tobacco_weight), 8, 'Record the tobacco weight'],
    [filled(i.tobacco_leaf_family), 4, 'Pick the leaf family'],
    [filled(i.tobacco_origin) || filled(i.tobacco_brand), 5, 'Name the tobacco brand or origin'],
    [filled(i.washed), 3, 'Say whether the leaf was washed'],
    [i.base_count >= 1, 8, 'Add base ingredients (glycerin, sweeteners…)'],
    [i.aroma_count >= 1, 10, 'Add at least one aroma'],
    [i.step_count >= 2, 10, 'Describe the process in 2+ steps'],
    [filled(i.initial_rest_hours) || filled(i.recommended_rest_hours), 6, 'Add a resting time'],
    [filled(i.storage_method), 3, 'Describe how it is stored'],
    [i.has_characteristics, 7, 'Rate strength, sweetness and other characteristics'],
    [i.profile_count >= 1, 4, 'Pick a flavour profile'],
    [i.source_count >= 1, 5, 'Add a source (even "personal experiment")'],
    [filled(i.creator_notes), 3, 'Add creator notes'],
  ];
  const total = checks.reduce((s, c) => s + c[1], 0);
  const score = checks.reduce((s, c) => s + (c[0] ? c[1] : 0), 0);
  return { score: Math.round((score / total) * 100), hints: checks.filter((c) => !c[0]).sort((a, b) => b[1] - a[1]).map((c) => c[2]).slice(0, 3) };
}
