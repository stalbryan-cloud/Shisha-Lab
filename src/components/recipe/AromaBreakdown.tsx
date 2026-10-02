import { formatPct } from '@/lib/core/scaler';
import type { ScaledRow } from '@/lib/core/scaler';

const ROLE_LABEL: Record<string, string> = { primary: 'Primary', secondary: 'Secondary', accent: 'Accent', cooling: 'Cooling', sweetener: 'Sweetener-like', modifier: 'Modifier' };

/** Horizontal bars of each aroma's share of the batch. Rows with unknown mass are listed without a bar, never guessed. */
export function AromaBreakdown({ rows }: { rows: ScaledRow[] }) {
  const aromas = rows.filter((r) => r.kind === 'aroma');
  if (!aromas.length) return <p className="text-sm text-mute">No aromas listed.</p>;
  const max = Math.max(...aromas.map((a) => a.pct_of_batch ?? 0), 0.0001);
  return (
    <ul className="space-y-2.5" aria-label="Aroma breakdown">
      {aromas.map((a) => (
        <li key={a.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{a.name}{a.brand && <span className="text-mute"> · {a.brand}</span>} {a.role && <span className="chip ml-1 py-0 text-[10px]">{ROLE_LABEL[a.role] ?? a.role}</span>}</span>
            <span className="tabular-nums text-mute">{a.pct_of_batch != null ? `${formatPct(a.pct_of_batch)}` : '—'}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-raised">
            {a.pct_of_batch != null && <div className="h-full rounded bg-amber" style={{ width: `${Math.max(2, (a.pct_of_batch / max) * 100)}%` }} />}
          </div>
          {a.note && <p className="mt-0.5 text-xs text-mute">{a.note}</p>}
        </li>
      ))}
    </ul>
  );
}
