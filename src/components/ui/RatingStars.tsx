import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only star display with half-star precision. Accessible label carries the numeric value. */
export function RatingStars({ value, count, size = 14, showValue = true, className }: { value: number | null; count?: number; size?: number; showValue?: boolean; className?: string }) {
  const v = value ?? 0;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="img" aria-label={value == null ? 'Not rated yet' : `Rated ${v.toFixed(1)} out of 5${count != null ? ` from ${count} ratings` : ''}`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, v - (i - 1)));
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star size={size} className="absolute inset-0 text-line" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="fill-amber text-amber" />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className="text-xs text-mute">
          {value == null ? 'No ratings yet' : <><span className="font-medium text-ink">{v.toFixed(1)}</span>{count != null && <> · {count}</>}</>}
        </span>
      )}
    </span>
  );
}
