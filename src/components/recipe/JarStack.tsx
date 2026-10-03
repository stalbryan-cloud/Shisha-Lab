import { jarBands, totalAromaPct } from '@/lib/core/flavour-colors';

type Aroma = { flavour_name: string; pct_of_batch: number | null };

/**
 * The aromas of a recipe as layers in a jar, in recipe order, taller layer = bigger share.
 * variant "cover": fills a card cover. "jar": a glass jar with a lid, used as the hero picture.
 * "strip": a slim bar for cards that already have a photo.
 */
export function JarStack({ aromas, variant = 'cover', className = '' }: { aromas: Aroma[]; variant?: 'cover' | 'jar' | 'strip'; className?: string }) {
  const bands = jarBands(aromas);
  const total = totalAromaPct(aromas);
  const summary = bands.length
    ? `Aromas, top to bottom: ${bands.map((b) => (b.pct ? `${b.name} ${b.pct}%` : b.name)).join(', ')}`
    : 'No aromas listed';

  if (variant === 'strip') {
    return (
      <div className={`flex h-2 w-full overflow-hidden rounded-full bg-raised ${className}`} role="img" aria-label={summary}>
        {bands.map((b, i) => <span key={i} style={{ flexGrow: b.weight, backgroundColor: b.color }} className="min-w-[3px]" />)}
      </div>
    );
  }

  const layers = (
    <div className="flex h-full w-full flex-col" role="img" aria-label={summary}>
      {bands.length ? bands.map((b, i) => (
        <div key={i} style={{ flexGrow: b.weight, backgroundColor: b.color }} className="jar-band">
          <span className="truncate text-sm font-medium">{b.name}</span>
          {b.pct != null && <span className="shrink-0 font-mono text-xs tabular-nums">{b.pct}%</span>}
        </div>
      )) : (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-sm text-mute">No aromas listed yet</div>
      )}
    </div>
  );

  if (variant === 'jar') {
    return (
      <figure className={`mx-auto w-full max-w-sm ${className}`}>
        <div aria-hidden className="mx-auto h-5 w-3/4 rounded-t-md border-2 border-b-0 border-ink bg-raised" />
        <div className="h-72 overflow-hidden rounded-b-[2.25rem] rounded-t-md border-2 border-ink bg-surface shadow-card">{layers}</div>
        {total && <figcaption className="mt-2 text-center font-mono text-xs text-mute">aroma total {total} of batch</figcaption>}
      </figure>
    );
  }

  return <div className={`h-full w-full ${className}`}>{layers}</div>;
}
