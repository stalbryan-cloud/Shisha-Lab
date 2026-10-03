import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * Read-only star display. Stars are drawn with a CSS mask (see `.stars` in globals.css) instead of ten inline
 * SVGs per row, which keeps pages with many recipe cards small. Accessible label carries the numeric value.
 */
export function RatingStars({ value, count, size = 14, showValue = true, className }: { value: number | null; count?: number; size?: number; showValue?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(5, value ?? 0));
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="img" aria-label={value == null ? 'Not rated yet' : `Rated ${v.toFixed(1)} out of 5${count != null ? ` from ${count} ratings` : ''}`}>
      <span className="stars" aria-hidden style={{ fontSize: size, '--v': `${(v / 5) * 100}%` } as CSSProperties} />
      {showValue && (
        <span className="text-xs text-mute">
          {value == null ? 'No ratings yet' : <><span className="font-medium text-ink">{v.toFixed(1)}</span>{count != null && <> · {count}</>}</>}
        </span>
      )}
    </span>
  );
}
