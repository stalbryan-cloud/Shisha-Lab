import Image from 'next/image';
import Link from 'next/link';
import { FlaskConical, Heart, Bookmark, Clock } from 'lucide-react';
import { RatingStars } from '@/components/ui/RatingStars';
import { publicImageUrl } from '@/lib/storage';
import { formatHours, formatVersion } from '@/lib/utils';
import { computeBadges, BADGE_LABELS } from '@/lib/core/badges';
import type { RecipeCardData } from '@/lib/types';

export function RecipeCard({ recipe: r, priority }: { recipe: RecipeCardData; priority?: boolean }) {
  const img = publicImageUrl(r.cover_image_path);
  const avg = r.review_count ? r.rating_sum / r.review_count : null;
  const badges = computeBadges({ made_count: r.made_count, completeness: r.completeness, review_count: r.review_count, bayes_rating: r.bayes_rating, like_count: r.like_count, save_count: r.save_count, updated_at: r.updated_at, is_featured: r.is_featured, version_major: r.version_major, version_minor: r.version_minor }).filter((b) => b !== 'community_pick').slice(0, 2);
  return (
    <article className="card group relative flex flex-col overflow-hidden transition-colors hover:border-amber/40">
      <Link href={`/recipes/${r.slug}`} className="absolute inset-0 z-10" aria-label={r.title} />
      <div className="relative aspect-[16/10] bg-raised">
        {img ? <Image src={img} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none" priority={priority} />
          : <div className="flex h-full items-center justify-center text-line"><FlaskConical size={44} aria-hidden /></div>}
        {r.is_featured && <span className="chip chip-amber absolute left-3 top-3">Community pick</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg leading-snug">{r.title}</h3>
        {r.short_description && <p className="line-clamp-2 text-sm text-mute">{r.short_description}</p>}
        {r.aromas.length > 0 && (
          <p className="line-clamp-1 text-xs text-ink/80">{r.aromas.slice(0, 4).map((a) => a.flavour_name).join(' · ')}{r.aromas.length > 4 ? ` +${r.aromas.length - 4}` : ''}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {r.tobacco_leaf_family && <span className="chip capitalize">{r.tobacco_leaf_family}</span>}
          {r.profiles.slice(0, 2).map((p) => <span key={p.slug} className="chip">{p.name}</span>)}
          {badges.map((b) => <span key={b} className="chip chip-amber" title={BADGE_LABELS[b].description}>{BADGE_LABELS[b].label}</span>)}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-mute">
          <RatingStars value={avg} count={r.review_count || undefined} size={13} />
          <span className="flex items-center gap-3">
            {r.recommended_rest_hours != null && <span className="inline-flex items-center gap-1" title="Recommended rest"><Clock size={12} aria-hidden />{formatHours(r.recommended_rest_hours)}</span>}
            <span className="inline-flex items-center gap-1" title="Made by"><FlaskConical size={12} aria-hidden />{r.made_count}</span>
            <span className="inline-flex items-center gap-1" title="Likes"><Heart size={12} aria-hidden />{r.like_count}</span>
            <span className="inline-flex items-center gap-1" title="Saves"><Bookmark size={12} aria-hidden />{r.save_count}</span>
          </span>
        </div>
        <p className="text-[11px] text-mute">by {r.creator ? `@${r.creator.username}` : '[deleted user]'} · {formatVersion(r.version_major, r.version_minor)}</p>
      </div>
    </article>
  );
}
