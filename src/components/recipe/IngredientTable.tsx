import { formatAmount, formatPct, fromGrams, type WeightUnit } from '@/lib/core/scaler';
import type { ScaledRow } from '@/lib/core/scaler';

const KIND_LABEL = { tobacco: 'Tobacco', base: 'Base', aroma: 'Aroma' } as const;

/** Rows arrive in grams; `unit` only changes display. `mode` switches between absolute amounts and percentages. */
export function IngredientTable({ rows, unit = 'g', mode = 'absolute' }: { rows: ScaledRow[]; unit?: WeightUnit; mode?: 'absolute' | 'percent' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Ingredients with amounts and percentages</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-mute">
            <th scope="col" className="py-2 pr-3 font-medium">Ingredient</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{mode === 'percent' ? 'Amount (reference)' : 'Amount'}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Volume</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">% of batch</th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">% of tobacco</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/50 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                {r.name}{r.brand && <span className="text-mute"> · {r.brand}</span>}
                <span className="ml-2 text-[11px] uppercase tracking-wide text-mute">{KIND_LABEL[r.kind]}</span>
                {r.note && <span className="block text-xs text-mute">{r.note}</span>}
                {r.basis === 'derived_from_percentage' && <span className="block text-xs text-mute">Calculated from the recorded percentage.</span>}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{r.weight_g != null ? formatAmount(fromGrams(r.weight_g, unit), unit) : <span className="text-mute" title="No reliable mass">—</span>}</td>
              <td className="px-3 py-2 text-right tabular-nums text-mute">{r.volume_ml != null ? `${formatAmount(r.volume_ml, 'ml')}` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.pct_of_batch != null ? formatPct(r.pct_of_batch) : '—'}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-mute">{r.pct_of_tobacco != null ? formatPct(r.pct_of_tobacco) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
