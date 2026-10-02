import Link from 'next/link';
import { Heart, FlaskConical, MessageSquare } from 'lucide-react';
import { RatingStars } from '@/components/ui/RatingStars';
import { formatHours, timeAgo } from '@/lib/utils';
import type { RecipeCardData } from '@/lib/types';

export function RecipeCompactRow({ recipe: r }: { recipe: RecipeCardData }) {
  const avg = r.review_count ? r.rating_sum / r.review_count : null;
  return (
    <li className="card relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:border-amber/40">
      <div className="min-w-0 flex-1 basis-56">
        <Link href={`/recipes/${r.slug}`} className="font-display text-base after:absolute after:inset-0 hover:text-amber">{r.title}</Link>
        <p className="line-clamp-1 text-xs text-mute">{r.aromas.slice(0, 5).map((a) => a.flavour_name).join(' · ') || r.short_description}</p>
      </div>
      <span className="chip capitalize">{r.tobacco_leaf_family ?? 'tobacco n/a'}</span>
      <RatingStars value={avg} count={r.review_count || undefined} size={12} />
      <span className="flex items-center gap-3 text-xs text-mute">
        <span className="inline-flex items-center gap-1"><FlaskConical size={12} aria-hidden />{r.made_count}</span>
        <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden />{r.like_count}</span>
        <span className="inline-flex items-center gap-1"><MessageSquare size={12} aria-hidden />{r.comment_count}</span>
        {r.recommended_rest_hours != null && <span>rest {formatHours(r.recommended_rest_hours)}</span>}
        <span>{timeAgo(r.updated_at)}</span>
      </span>
    </li>
  );
}
