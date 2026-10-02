'use client';
import { useMemo, useState } from 'react';
import { scaleRecipe, toGrams, fromGrams, formatAmount, formatPct, type AromaInput, type BaseIngredientInput, type WeightUnit } from '@/lib/core/scaler';
import { IngredientTable } from './IngredientTable';
import { AromaBreakdown } from './AromaBreakdown';

interface Props {
  tobaccoWeightG: number;
  batchWeightG: number | null;
  base: BaseIngredientInput[];
  aromas: AromaInput[];
  unit: WeightUnit;
  tobaccoName: string;
  tobaccoBrand?: string | null;
}

const UNITS: WeightUnit[] = ['g', 'kg', 'oz', 'lb'];

export function RecipeScaler({ tobaccoWeightG, batchWeightG, base, aromas, unit: initialUnit, tobaccoName, tobaccoBrand }: Props) {
  const original = useMemo(() => scaleRecipe({ tobacco_weight_g: tobaccoWeightG, base, aromas, batch_weight_g: batchWeightG }), [tobaccoWeightG, base, aromas, batchWeightG]);
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [targetStr, setTargetStr] = useState('');
  const [mode, setMode] = useState<'absolute' | 'percent'>('absolute');

  const targetG = (() => { const n = parseFloat(targetStr.replace(',', '.')); return Number.isFinite(n) && n > 0 ? toGrams(n, unit) : null; })();
  const scaled = useMemo(() => scaleRecipe({ tobacco_weight_g: tobaccoWeightG, base, aromas, batch_weight_g: batchWeightG }, targetG), [tobaccoWeightG, base, aromas, batchWeightG, targetG]);
  const tableRows = scaled.rows.map((r) => (r.kind === 'tobacco' ? { ...r, name: tobaccoName, brand: tobaccoBrand } : r));
  const c = scaled.composition, ratios = scaled.ratios;

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3 p-4 no-print">
        <div>
          <label htmlFor="scale-target" className="label">Scale to batch weight</label>
          <div className="flex gap-2">
            <input id="scale-target" inputMode="decimal" className="field w-32" placeholder={formatAmount(fromGrams(original.target_batch_g, unit), '').trim()} value={targetStr} onChange={(e) => setTargetStr(e.target.value)} aria-describedby="scale-help" />
            <select aria-label="Weight unit" className="field w-20" value={unit} onChange={(e) => { const u = e.target.value as WeightUnit; if (targetG) setTargetStr(String(Number(fromGrams(targetG, u).toFixed(3)))); setUnit(u); }}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div role="group" aria-label="Display mode" className="inline-flex overflow-hidden rounded-md border border-line">
          {(['absolute', 'percent'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`min-h-10 px-3 text-sm ${mode === m ? 'bg-amber text-bg' : 'bg-surface hover:bg-raised'}`}>{m === 'absolute' ? 'Amounts' : 'Percentages'}</button>
          ))}
        </div>
        {targetG && <button type="button" className="btn btn-ghost" onClick={() => setTargetStr('')}>Reset to original</button>}
        <p id="scale-help" className="basis-full text-xs text-mute">
          Everything scales proportionally by mass. Volumes are never converted to grams (or back) unless a density was recorded. Scaling does not judge whether a ratio is “right”.
          {targetG ? ` Scaled ×${Number(scaled.factor.toFixed(3))}.` : ''}
        </p>
      </div>

      <IngredientTable rows={tableRows} unit={unit} mode={mode} />
      {mode === 'percent' && <p className="text-xs text-mute">Percentages are shares of the finished batch by mass; they do not change when you scale.</p>}

      {scaled.warnings.length > 0 && (
        <ul className="rounded-md border border-amber/30 bg-amber/5 p-3 text-sm text-amber" role="note">
          {scaled.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="comp-h" className="card p-4">
          <h3 id="comp-h" className="font-display text-lg">Composition (by mass)</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-mute">Tobacco</dt><dd className="text-right tabular-nums">{formatPct(c.tobacco_pct)}</dd>
            <dt className="text-mute">Glycerin</dt><dd className="text-right tabular-nums">{formatPct(c.glycerin_pct)}</dd>
            <dt className="text-mute">Sweeteners</dt><dd className="text-right tabular-nums">{formatPct(c.sweetener_pct)}</dd>
            <dt className="text-mute">Aromas</dt><dd className="text-right tabular-nums">{formatPct(c.aroma_pct)}</dd>
            <dt className="text-mute">Other liquids</dt><dd className="text-right tabular-nums">{formatPct(c.other_liquid_pct)}</dd>
          </dl>
          <hr className="my-3 border-line" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-mute">Tobacco : wet mass</dt><dd className="text-right tabular-nums">{ratios.tobacco_to_wet != null ? `1 : ${Number(ratios.tobacco_to_wet.toFixed(2))}` : '—'}</dd>
            <dt className="text-mute">Glycerin : sweetener</dt><dd className="text-right tabular-nums">{ratios.vg_to_sweetener != null ? `${Number(ratios.vg_to_sweetener.toFixed(2))} : 1` : '—'}</dd>
            <dt className="text-mute">Flavour load</dt><dd className="text-right tabular-nums">{formatPct(ratios.flavour_load_pct)}</dd>
          </dl>
          {scaled.has_unconvertible && <p className="mt-3 text-xs text-mute">Some rows have no reliable mass, so these figures are approximate.</p>}
        </section>
        <section aria-labelledby="aroma-h" className="card p-4">
          <h3 id="aroma-h" className="font-display text-lg">Aroma breakdown</h3>
          <div className="mt-3"><AromaBreakdown rows={scaled.rows} /></div>
        </section>
      </div>
    </div>
  );
}
