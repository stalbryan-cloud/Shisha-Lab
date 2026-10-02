/**
 * Quality signals. These describe PLATFORM EVIDENCE only — none of them claims a recipe is safe, verified or
 * scientifically validated.
 *
 *  Community Tested  ≥ 3 public "I made this" results from members other than the creator.
 *  Frequently Made   ≥ 10 such results.
 *  Well Documented   completeness ≥ 80 (structured fields, process, maturation and at least one source filled in).
 *  Highly Rated      ≥ 5 reviews and a weighted (Bayesian) rating ≥ 4.2.
 *  Popular           ≥ 15 likes + saves combined.
 *  Updated Recently  a newer version than 1.0 published within the last 30 days.
 *  Community Pick    featured by a moderator/editor (is_featured).
 */
export interface BadgeInput {
  made_count: number; completeness: number; review_count: number; bayes_rating: number;
  like_count: number; save_count: number; is_featured: boolean;
  version_major: number; version_minor: number; updated_at: string | Date;
}
export type BadgeKey = 'community_tested' | 'frequently_made' | 'well_documented' | 'highly_rated' | 'popular' | 'updated_recently' | 'community_pick';
export const BADGE_LABELS: Record<BadgeKey, { label: string; description: string }> = {
  community_tested: { label: 'Community Tested', description: 'At least 3 members have logged a result. Not a safety or quality guarantee.' },
  frequently_made: { label: 'Frequently Made', description: 'Logged as made by 10 or more members.' },
  well_documented: { label: 'Well Documented', description: 'Most structured fields, process steps and sources are filled in.' },
  highly_rated: { label: 'Highly Rated', description: 'Strong weighted rating from at least 5 reviews.' },
  popular: { label: 'Popular', description: 'Many members have liked or saved this recipe.' },
  updated_recently: { label: 'Updated Recently', description: 'A new version was published in the last 30 days.' },
  community_pick: { label: 'Community Pick', description: 'Featured by the moderators.' },
};

export function computeBadges(r: BadgeInput, now = new Date()): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (r.is_featured) out.push('community_pick');
  if (r.made_count >= 10) out.push('frequently_made');
  else if (r.made_count >= 3) out.push('community_tested');
  if (r.review_count >= 5 && r.bayes_rating >= 4.2) out.push('highly_rated');
  if (r.like_count + r.save_count >= 15) out.push('popular');
  if (r.completeness >= 80) out.push('well_documented');
  const newer = r.version_major > 1 || r.version_minor > 0;
  if (newer && now.getTime() - new Date(r.updated_at).getTime() < 30 * 86400000) out.push('updated_recently');
  return out;
}
