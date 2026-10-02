'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { saveRecipe, publishRecipe } from '@/lib/actions/recipes';
import { completeness, publishBlockers } from '@/lib/core/completeness';
import { scaleRecipe, toGrams, formatPct } from '@/lib/core/scaler';
import {
  AROMA_ROLES, BASE_CATEGORIES, BASE_CATEGORY_LABELS, SOURCE_TYPES, SOURCE_TYPE_LABELS, STEP_CATEGORIES, STEP_CATEGORY_LABELS, type RecipeDraftInput,
} from '@/lib/validators/recipe';
import { SortableList, type WithKey } from './SortableList';
import { FileUploader } from './FileUploader';
import { cn } from '@/lib/utils';

type Row<T> = T & WithKey;
type Obj = Record<string, unknown>;
export interface Catalog {
  aromas: { id: string; name: string; brand: string | null; flavour_id: string | null; rec_max: number | null }[];
  tobaccos: { id: string; label: string; brand: string | null; product_name: string; family: string | null; leaf_type: string | null; variety: string | null; origin: string | null; cut: string | null }[];
  flavours: { id: string; name: string }[];
  profiles: { slug: string; name: string }[];
  tags: string[];
}
interface Draft extends Omit<RecipeDraftInput, 'base' | 'aromas' | 'steps' | 'sources'> {
  base: Row<Obj>[]; aromas: Row<Obj>[]; steps: Row<Obj>[]; sources: Row<Obj>[];
}
export interface WizardInitial extends Omit<RecipeDraftInput, 'base' | 'aromas' | 'steps' | 'sources'> {
  base?: Obj[]; aromas?: Obj[]; steps?: Obj[]; sources?: Obj[]; status?: string; slug?: string; version?: string;
}

const STEPS = ['Basics', 'Tobacco', 'Base', 'Aromas', 'Process', 'Maturation', 'Profile', 'Sources', 'Notes & media', 'Review'] as const;
let keySeq = 0;
const k = () => `k${Date.now().toString(36)}${keySeq++}`;
const withKeys = (rows: Obj[] | undefined): Row<Obj>[] => (rows ?? []).map((r) => ({ ...r, _k: k() }));
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

function Text({ label, value, onChange, hint, type = 'text', ...rest }: { label: string; value: unknown; onChange: (v: string) => void; hint?: string; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useMemo(() => `w${Math.random().toString(36).slice(2, 8)}`, []);
  return <div><label className="label" htmlFor={id}>{label}</label><input id={id} className="field" type={type} value={s(value)} onChange={(e) => onChange(e.target.value)} {...rest} />{hint && <p className="mt-1 text-xs text-mute">{hint}</p>}</div>;
}
function Area({ label, value, onChange, rows = 4, hint, max }: { label: string; value: unknown; onChange: (v: string) => void; rows?: number; hint?: string; max?: number }) {
  const id = useMemo(() => `w${Math.random().toString(36).slice(2, 8)}`, []);
  return <div><label className="label" htmlFor={id}>{label}</label><textarea id={id} rows={rows} maxLength={max} className="field py-2" value={s(value)} onChange={(e) => onChange(e.target.value)} />{hint && <p className="mt-1 text-xs text-mute">{hint}</p>}</div>;
}
function Select({ label, value, onChange, options, blank }: { label: string; value: unknown; onChange: (v: string) => void; options: [string, string][]; blank?: string }) {
  const id = useMemo(() => `w${Math.random().toString(36).slice(2, 8)}`, []);
  return <div><label className="label" htmlFor={id}>{label}</label><select id={id} className="field" value={s(value)} onChange={(e) => onChange(e.target.value)}>{blank !== undefined && <option value="">{blank}</option>}{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}
function Scale5({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  const cur = num(value);
  return (
    <fieldset><legend className="label">{label}</legend>
      <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} aria-pressed={cur === n} onClick={() => onChange(cur === n ? '' : String(n))} className={cn('h-10 w-10 rounded-md border text-sm', cur === n ? 'border-amber bg-amber text-bg' : 'border-line bg-surface hover:border-amber/50')}>{n}</button>
      ))}<button type="button" className="px-2 text-xs text-mute hover:text-ink" onClick={() => onChange('')}>clear</button></div>
    </fieldset>
  );
}

export function RecipeWizard({ initial, catalog, maxImageMb }: { initial: WizardInitial; catalog: Catalog; maxImageMb: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initial, id: initial.id ?? null, title: initial.title ?? '', units: initial.units ?? 'g', visibility: initial.visibility ?? 'public',
    tobacco: { ...(initial.tobacco ?? {}) }, maturation: { ...(initial.maturation ?? {}) }, characteristics: { ...(initial.characteristics ?? {}) },
    profile_slugs: initial.profile_slugs ?? [], tags: initial.tags ?? [], equipment: initial.equipment ?? [],
    base: withKeys(initial.base), aromas: withKeys(initial.aromas), steps: withKeys(initial.steps), sources: withKeys(initial.sources),
  }));
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<{ kind: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'; at?: string; msg?: string }>({ kind: 'idle' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [slug, setSlug] = useState(initial.slug ?? '');
  const [recipeStatus, setRecipeStatus] = useState(initial.status ?? 'draft');
  const [version, setVersion] = useState(initial.version ?? '');
  const [pub, startPublish] = useTransition();
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [bump, setBump] = useState<'minor' | 'major'>('minor');
  const draftRef = useRef(draft); draftRef.current = draft;
  const idRef = useRef<string | null>(initial.id ?? null);
  const dirty = useRef(false);
  const inflight = useRef<Promise<boolean> | null>(null);

  const patch = useCallback((fn: (d: Draft) => Draft) => { dirty.current = true; setStatus((st) => (st.kind === 'saving' ? st : { kind: 'dirty' })); setDraft(fn); }, []);
  const set = <K extends keyof Draft>(key: K, v: Draft[K]) => patch((d) => ({ ...d, [key]: v }));
  const sub = (group: 'tobacco' | 'maturation' | 'characteristics', key: string, v: unknown) => patch((d) => ({ ...d, [group]: { ...(d[group] as Obj), [key]: v } }));

  const hasContent = (d: Draft) => !!(s(d.title).trim() || d.aromas.length || d.steps.length || d.base.length || s((d.tobacco as Obj)?.weight));

  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    const d = draftRef.current;
    if (!hasContent(d)) return true;
    setStatus({ kind: 'saving' });
    dirty.current = false;
    const run = (async () => {
      // rows the user has added but not started filling in are kept in the UI but not sent (they would fail validation)
      const blank = (r: Obj, keys: string[]) => keys.every((x) => s(r[x]).trim() === '');
      const payload = {
        ...d, id: idRef.current, step,
        base: d.base.filter((r) => !blank(r, ['name', 'weight_g', 'volume_ml', 'brand'])),
        aromas: d.aromas.filter((r) => !blank(r, ['flavour_name', 'weight_g', 'volume_ml', 'pct_of_batch', 'concentrate_name'])),
        steps: d.steps.filter((r) => !blank(r, ['title', 'instructions'])),
        sources: d.sources.filter((r) => !blank(r, ['title', 'url', 'file_path'])),
      };
      const res = await saveRecipe(payload as RecipeDraftInput);
      if (res.ok && res.data) {
        idRef.current = res.data.id; setSlug(res.data.slug);
        if (!d.id) setDraft((x) => ({ ...x, id: res.data!.id }));
        window.history.replaceState(null, '', `/recipes/${res.data.slug}/edit`);
        setFieldErrors({});
        setStatus({ kind: dirty.current ? 'dirty' : 'saved', at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        return true;
      }
      dirty.current = true;
      if (!res.ok) { setFieldErrors(res.fieldErrors ?? {}); setStatus({ kind: 'error', msg: res.error }); }
      return false;
    })();
    inflight.current = run;
    const r = await run; inflight.current = null; return r;
  }, [step]);

  // autosave 2.5 s after the last change, and warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => { void save(); }, 2500);
    return () => clearTimeout(t);
  }, [draft, save]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const T = draft.tobacco as Obj, M = draft.maturation as Obj, C = draft.characteristics as Obj;
  const unit = (draft.units ?? 'g') as 'g' | 'kg' | 'oz' | 'lb';

  const meter = useMemo(() => completeness({
    title: draft.title, short_description: s(draft.short_description), cover_image_path: s(draft.cover_image_path), target_batch_weight: num(draft.target_batch_weight),
    tobacco_weight: num(T.weight), tobacco_leaf_family: s(T.leaf_family) || null, tobacco_origin: s(T.origin), tobacco_brand: s(T.brand), washed: T.washed as boolean | null,
    base_count: draft.base.length, aroma_count: draft.aromas.length, step_count: draft.steps.length,
    initial_rest_hours: num(M.initial_rest_hours), recommended_rest_hours: num(M.recommended_rest_hours), storage_method: s(M.storage_method),
    has_characteristics: Object.values(C).some((v) => s(v) !== ''), profile_count: draft.profile_slugs?.length ?? 0, source_count: draft.sources.length, creator_notes: s(draft.creator_notes),
  }), [draft, T, M, C]);
  const blockers = useMemo(() => publishBlockers({
    title: draft.title, tobacco_weight: num(T.weight), tobacco_leaf_family: s(T.leaf_family) || null,
    base_count: draft.base.length, aroma_count: draft.aromas.length, step_count: draft.steps.length, has_characteristics: false, profile_count: 0, source_count: 0,
  }), [draft, T]);

  // live composition preview (grams for base/aroma rows; tobacco & batch in the recipe's unit)
  const preview = useMemo(() => {
    const tw = num(T.weight);
    if (!tw || tw <= 0) return null;
    try {
      return scaleRecipe({
        tobacco_weight_g: toGrams(tw, unit), batch_weight_g: num(draft.actual_final_weight) ?? num(draft.target_batch_weight) ? toGrams((num(draft.actual_final_weight) ?? num(draft.target_batch_weight))!, unit) : null,
        base: draft.base.map((b, i) => ({ id: `b${i}`, category: (s(b.category) || 'other') as never, name: s(b.name), weight_g: num(b.weight_g), volume_ml: num(b.volume_ml), density_g_per_ml: num(b.density_g_per_ml) })),
        aromas: draft.aromas.map((a, i) => ({ id: `a${i}`, flavour_name: s(a.flavour_name), weight_g: num(a.weight_g), volume_ml: num(a.volume_ml), pct_of_batch: num(a.pct_of_batch), role: s(a.role) || 'primary' })),
      });
    } catch { return null; }
  }, [draft, T, unit]);

  const err = (path: string) => fieldErrors[path]?.[0];
  const go = async (n: number) => { if (dirty.current) await save(); setStep(n); window.scrollTo({ top: 0 }); };

  async function doPublish() {
    setPubMsg(null);
    startPublish(async () => {
      const okSave = await save();
      if (!okSave || !idRef.current) { setPubMsg({ ok: false, text: 'Fix the problems above before publishing.' }); return; }
      if (recipeStatus === 'published' && !changeNotes.trim()) { setPubMsg({ ok: false, text: 'Describe what changed so people can follow the history.' }); return; }
      const r = await publishRecipe(idRef.current, { change_notes: changeNotes || null, bump });
      if (r.ok && r.data) { dirty.current = false; setRecipeStatus('published'); setVersion(r.data.version); router.push(`/recipes/${r.data.slug}`); }
      else if (!r.ok) setPubMsg({ ok: false, text: r.error });
    });
  }

  // catalog helpers ---------------------------------------------------------------------------------------------
  const pickAroma = (i: number, label: string) => {
    const m = catalog.aromas.find((a) => `${a.brand ? `${a.brand} — ` : ''}${a.name}` === label);
    patch((d) => ({ ...d, aromas: d.aromas.map((a, j) => (j === i ? { ...a, concentrate_name: m ? m.name : label, aroma_id: m?.id ?? null, brand: m ? m.brand : a.brand, flavour_id: m?.flavour_id ?? a.flavour_id ?? null, flavour_name: s(a.flavour_name) || (m ? m.name : ''), manufacturer_recommended_pct: m?.rec_max ?? a.manufacturer_recommended_pct ?? '' } : a)) }));
  };
  const pickTobacco = (label: string) => {
    const m = catalog.tobaccos.find((t) => t.label === label);
    patch((d) => ({ ...d, tobacco: { ...(d.tobacco as Obj), ...(m ? { tobacco_id: m.id, brand: m.brand, product_name: m.product_name, leaf_family: m.family ?? (d.tobacco as Obj).leaf_family, leaf_type: m.leaf_type ?? (d.tobacco as Obj).leaf_type, variety: m.variety ?? (d.tobacco as Obj).variety, origin: m.origin ?? (d.tobacco as Obj).origin, cut: m.cut ?? (d.tobacco as Obj).cut } : { tobacco_id: null, product_name: label }) } }));
  };

  const statusText = status.kind === 'saving' ? 'Saving…' : status.kind === 'saved' ? `Draft saved ${status.at}` : status.kind === 'dirty' ? 'Unsaved changes…' : status.kind === 'error' ? `Not saved: ${status.msg}` : 'Changes save automatically';

  return (
    <div className="container py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl sm:text-3xl">{recipeStatus === 'published' ? 'Edit recipe' : 'Create a recipe'}{version && <span className="ml-2 text-base text-mute">{version}</span>}</h1>
          <p className={cn('text-sm', status.kind === 'error' ? 'text-danger' : 'text-mute')} role="status" aria-live="polite">{statusText}</p></div>
        <div className="flex items-center gap-3">
          <div className="w-40" role="img" aria-label={`Completeness ${meter.score} percent`}><div className="flex justify-between text-xs text-mute"><span>Completeness</span><span>{meter.score}%</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-raised"><div className="h-full bg-amber transition-all" style={{ width: `${meter.score}%` }} /></div></div>
          <button type="button" className="btn" onClick={() => void save()} disabled={status.kind === 'saving'}>Save now</button>
        </div>
      </div>

      <nav aria-label="Wizard steps" className="-mx-4 mb-6 overflow-x-auto px-4"><ol className="flex gap-1.5 whitespace-nowrap">{STEPS.map((l, i) => (
        <li key={l}><button type="button" onClick={() => void go(i + 1)} aria-current={step === i + 1 ? 'step' : undefined} className={cn('rounded-md border px-3 py-2 text-sm', step === i + 1 ? 'border-amber bg-amber/10 text-amber' : 'border-line bg-surface text-mute hover:text-ink')}><span className="mr-1.5 text-xs opacity-70">{i + 1}</span>{l}</button></li>
      ))}</ol></nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-label={`Step ${step}: ${STEPS[step - 1]}`} className="space-y-5">
          {step === 1 && (<>
            <h2 className="section-title">Basics</h2>
            <Text label="Recipe title" value={draft.title} onChange={(v) => set('title', v)} maxLength={120} required />{err('title') && <p role="alert" className="text-xs text-danger">{err('title')}</p>}
            <Area label="Short description" value={draft.short_description} onChange={(v) => set('short_description', v)} rows={2} max={280} hint="One or two sentences shown on recipe cards." />
            <Area label="Full description (Markdown supported)" value={draft.long_description} onChange={(v) => set('long_description', v)} rows={7} max={20000} hint="Background, goals, flavour direction. Tell people what you were trying to achieve." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Units for tobacco & batch weights" value={draft.units} onChange={(v) => set('units', v as never)} options={[['g', 'Grams (g)'], ['kg', 'Kilograms (kg)'], ['oz', 'Ounces (oz)'], ['lb', 'Pounds (lb)']]} />
              <Select label="Visibility" value={draft.visibility} onChange={(v) => set('visibility', v as never)} options={[['public', 'Public — listed and searchable'], ['unlisted', 'Unlisted — only with the link'], ['private', 'Private — only me']]} />
              <Text label={`Target batch weight (${unit})`} inputMode="decimal" value={draft.target_batch_weight} onChange={(v) => set('target_batch_weight', v)} hint="Optional. What you planned to make." />
              <Text label={`Actual final weight (${unit})`} inputMode="decimal" value={draft.actual_final_weight} onChange={(v) => set('actual_final_weight', v)} hint="Optional. What you ended up with." />
            </div>
          </>)}

          {step === 2 && (<>
            <h2 className="section-title">Tobacco</h2>
            <div><label className="label" htmlFor="tob-pick">Pick from the database (or type your own)</label>
              <input id="tob-pick" list="tob-list" className="field" value={[s(T.brand), s(T.product_name)].filter(Boolean).join(' — ')} onChange={(e) => pickTobacco(e.target.value)} placeholder="Brand — product" />
              <datalist id="tob-list">{catalog.tobaccos.map((t) => <option key={t.id} value={t.label} />)}</datalist></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Brand / manufacturer" value={T.brand} onChange={(v) => sub('tobacco', 'brand', v)} />
              <Text label="Product name" value={T.product_name} onChange={(v) => sub('tobacco', 'product_name', v)} />
              <Select label="Leaf family" value={T.leaf_family} blank="Not specified" onChange={(v) => sub('tobacco', 'leaf_family', v || null)} options={[['blonde', 'Blonde'], ['dark', 'Dark'], ['other', 'Other']]} />
              <Text label="Leaf type" value={T.leaf_type} onChange={(v) => sub('tobacco', 'leaf_type', v)} placeholder="e.g. Virginia, Burley, Dark fired" />
              <Text label="Variety" value={T.variety} onChange={(v) => sub('tobacco', 'variety', v)} />
              <Text label="Origin" value={T.origin} onChange={(v) => sub('tobacco', 'origin', v)} />
              <Text label="Cut" value={T.cut} onChange={(v) => sub('tobacco', 'cut', v)} />
              <Select label="Strength category" value={T.strength_category} blank="Not specified" onChange={(v) => sub('tobacco', 'strength_category', v || null)} options={[['mild', 'Mild'], ['medium', 'Medium'], ['strong', 'Strong'], ['very_strong', 'Very strong']]} />
              <Text label={`Dry tobacco weight (${unit})`} inputMode="decimal" value={T.weight} onChange={(v) => sub('tobacco', 'weight', v)} hint="Needed for percentages and scaling." />{err('tobacco.weight') && <p role="alert" className="text-xs text-danger">{err('tobacco.weight')}</p>}
            </div>
            <fieldset className="space-y-3 rounded-md border border-line p-4"><legend className="px-1 text-sm">Preparation</legend>
              <div role="radiogroup" aria-label="Washed" className="flex gap-4 text-sm">{([['null', 'Not stated'], ['true', 'Washed'], ['false', 'Not washed']] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-2"><input type="radio" name="washed" checked={String(T.washed ?? 'null') === v} onChange={() => sub('tobacco', 'washed', v === 'null' ? null : v === 'true')} />{l}</label>))}</div>
              {T.washed === true && <div className="grid gap-4 sm:grid-cols-2"><Text label="Wash method" value={T.wash_method} onChange={(v) => sub('tobacco', 'wash_method', v)} /><Text label="Wash duration (minutes)" inputMode="numeric" value={T.wash_duration_minutes} onChange={(v) => sub('tobacco', 'wash_duration_minutes', v)} /></div>}
              <div className="grid gap-4 sm:grid-cols-2"><Text label="Drying method" value={T.drying_method} onChange={(v) => sub('tobacco', 'drying_method', v)} /><Text label="Drying duration (minutes)" inputMode="numeric" value={T.drying_duration_minutes} onChange={(v) => sub('tobacco', 'drying_duration_minutes', v)} /></div>
            </fieldset>
            <Area label="Tobacco notes" value={T.notes} onChange={(v) => sub('tobacco', 'notes', v)} rows={3} />
          </>)}

          {step === 3 && (<>
            <h2 className="section-title">Base ingredients</h2>
            <p className="text-sm text-mute">Glycerin, sweeteners, water… Enter a <strong>weight in grams</strong> or a volume. A volume is only converted to grams if you also enter a density — we never guess.</p>
            <SortableList items={draft.base as Row<Obj>[]} onChange={(v) => set('base', v)} itemLabel={(b, i) => s(b.name) || `base ingredient ${i + 1}`} renderItem={(b, i) => {
              const up = (key: string, v: unknown) => patch((d) => ({ ...d, base: d.base.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }));
              const e = (key: string) => err(`base.${i}.${key}`);
              return (<div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-2"><Select label="Type" value={b.category} onChange={(v) => up('category', v)} options={BASE_CATEGORIES.map((c) => [c, BASE_CATEGORY_LABELS[c]])} /></div>
                <div className="sm:col-span-2"><Text label="Name" value={b.name} onChange={(v) => up('name', v)} />{e('name') && <p role="alert" className="text-xs text-danger">{e('name')}</p>}</div>
                <div className="sm:col-span-2"><Text label="Brand (optional)" value={b.brand} onChange={(v) => up('brand', v)} /></div>
                <Text label="Weight (g)" inputMode="decimal" value={b.weight_g} onChange={(v) => up('weight_g', v)} />
                <Text label="Volume (ml)" inputMode="decimal" value={b.volume_ml} onChange={(v) => up('volume_ml', v)} />
                <Text label="Density (g/ml)" inputMode="decimal" value={b.density_g_per_ml} onChange={(v) => up('density_g_per_ml', v)} />
                <div className="sm:col-span-3"><Text label="Notes" value={b.notes} onChange={(v) => up('notes', v)} /></div>
                {e('weight_g') && <p role="alert" className="text-xs text-danger sm:col-span-6">{e('weight_g')}</p>}
              </div>);
            }} />
            <button type="button" className="btn" onClick={() => set('base', [...draft.base, { _k: k(), category: 'vegetable_glycerin', name: '' }])}><Plus size={16} aria-hidden /> Add base ingredient</button>
          </>)}

          {step === 4 && (<>
            <h2 className="section-title">Aromas</h2>
            <p className="text-sm text-mute">Add as many as you need. Give each a weight (g) <em>or</em> its percentage of the finished batch. Drag to reorder.</p>
            <datalist id="aroma-list">{catalog.aromas.map((a) => <option key={a.id} value={`${a.brand ? `${a.brand} — ` : ''}${a.name}`} />)}</datalist>
            <datalist id="flavour-list">{catalog.flavours.map((f) => <option key={f.id} value={f.name} />)}</datalist>
            <SortableList items={draft.aromas as Row<Obj>[]} onChange={(v) => set('aromas', v)} itemLabel={(a, i) => s(a.flavour_name) || `aroma ${i + 1}`} renderItem={(a, i) => {
              const up = (key: string, v: unknown) => patch((d) => ({ ...d, aromas: d.aromas.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }));
              const e = (key: string) => err(`aromas.${i}.${key}`);
              return (<div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-3"><label className="label" htmlFor={`ar-${a._k}`}>Flavour</label><input id={`ar-${a._k}`} list="flavour-list" className="field" value={s(a.flavour_name)} onChange={(ev) => { const m = catalog.flavours.find((f) => f.name.toLowerCase() === ev.target.value.toLowerCase()); patch((d) => ({ ...d, aromas: d.aromas.map((x, j) => (j === i ? { ...x, flavour_name: ev.target.value, flavour_id: m?.id ?? null } : x)) })); }} />{e('flavour_name') && <p role="alert" className="text-xs text-danger">{e('flavour_name')}</p>}</div>
                <div className="sm:col-span-3"><label className="label" htmlFor={`ac-${a._k}`}>Aroma product (pick or type)</label><input id={`ac-${a._k}`} list="aroma-list" className="field" value={s(a.concentrate_name)} onChange={(ev) => pickAroma(i, ev.target.value)} /></div>
                <div className="sm:col-span-2"><Text label="Brand" value={a.brand} onChange={(v) => up('brand', v)} /></div>
                <div className="sm:col-span-2"><Select label="Role" value={a.role ?? 'primary'} onChange={(v) => up('role', v)} options={AROMA_ROLES.map((r) => [r, r[0].toUpperCase() + r.slice(1)])} /></div>
                <div className="sm:col-span-2"><Text label="Manufacturer rec. max (%)" inputMode="decimal" value={a.manufacturer_recommended_pct} onChange={(v) => up('manufacturer_recommended_pct', v)} /></div>
                <Text label="Weight (g)" inputMode="decimal" value={a.weight_g} onChange={(v) => up('weight_g', v)} />
                <Text label="Volume (ml)" inputMode="decimal" value={a.volume_ml} onChange={(v) => up('volume_ml', v)} />
                <Text label="% of batch" inputMode="decimal" value={a.pct_of_batch} onChange={(v) => up('pct_of_batch', v)} />
                <div className="sm:col-span-3"><Text label="Notes" value={a.notes} onChange={(v) => up('notes', v)} /></div>
                {e('pct_of_batch') && <p role="alert" className="text-xs text-danger sm:col-span-6">{e('pct_of_batch')}</p>}
                {num(a.manufacturer_recommended_pct) !== null && num(a.pct_of_batch) !== null && num(a.pct_of_batch)! > num(a.manufacturer_recommended_pct)! && <p role="note" className="text-xs text-amber sm:col-span-6">This is above the manufacturer’s stated maximum. That’s allowed — just worth noting in your recipe.</p>}
              </div>);
            }} />
            <button type="button" className="btn" onClick={() => set('aromas', [...draft.aromas, { _k: k(), role: 'primary', flavour_name: '' }])}><Plus size={16} aria-hidden /> Add aroma</button>
          </>)}

          {step === 5 && (<>
            <h2 className="section-title">Process</h2>
            <p className="text-sm text-mute">One step per action, in order. Markdown works in the instructions.</p>
            <SortableList items={draft.steps as Row<Obj>[]} onChange={(v) => set('steps', v)} itemLabel={(x, i) => s(x.title) || `step ${i + 1}`} renderItem={(st, i) => {
              const up = (key: string, v: unknown) => patch((d) => ({ ...d, steps: d.steps.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }));
              const e = (key: string) => err(`steps.${i}.${key}`);
              return (<div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-4"><Text label={`Step ${i + 1} title`} value={st.title} onChange={(v) => up('title', v)} />{e('title') && <p role="alert" className="text-xs text-danger">{e('title')}</p>}</div>
                <div className="sm:col-span-2"><Select label="Category" value={st.category} blank="—" onChange={(v) => up('category', v || null)} options={STEP_CATEGORIES.map((c) => [c, STEP_CATEGORY_LABELS[c]])} /></div>
                <div className="sm:col-span-6"><Area label="Instructions" value={st.instructions} onChange={(v) => up('instructions', v)} rows={3} max={4000} />{e('instructions') && <p role="alert" className="text-xs text-danger">{e('instructions')}</p>}</div>
                <div className="sm:col-span-2"><Text label="Duration (minutes)" inputMode="numeric" value={st.duration_minutes} onChange={(v) => up('duration_minutes', v)} /></div>
                <Text label="Temperature" inputMode="decimal" value={st.temperature} onChange={(v) => up('temperature', v)} />
                <Select label="Unit" value={st.temperature_unit ?? 'C'} onChange={(v) => up('temperature_unit', v)} options={[['C', '°C'], ['F', '°F']]} />
                <div className="sm:col-span-6"><FileUploader kind="step" label="Photo (optional)" accept="image/jpeg,image/png,image/webp" value={s(st.photo_path) || null} onUploaded={(f) => up('photo_path', f.path)} onClear={() => up('photo_path', null)} hint={`JPG, PNG or WebP, up to ${maxImageMb} MB.`} /></div>
              </div>);
            }} />
            <button type="button" className="btn" onClick={() => set('steps', [...draft.steps, { _k: k(), title: '', instructions: '' }])}><Plus size={16} aria-hidden /> Add step</button>
          </>)}

          {step === 6 && (<>
            <h2 className="section-title">Maturation</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Initial rest (hours)" inputMode="decimal" value={M.initial_rest_hours} onChange={(v) => sub('maturation', 'initial_rest_hours', v)} hint="Before the first taste test." />
              <Text label="Recommended total rest (hours)" inputMode="decimal" value={M.recommended_rest_hours} onChange={(v) => sub('maturation', 'recommended_rest_hours', v)} />
              <Text label="Rest temperature (°C)" inputMode="decimal" value={M.rest_temperature_c} onChange={(v) => sub('maturation', 'rest_temperature_c', v)} />
            </div>
            <Area label="Mixing schedule" value={M.mixing_schedule} onChange={(v) => sub('maturation', 'mixing_schedule', v)} rows={2} hint="e.g. stir after 12 h, then every 24 h" />
            <Area label="Storage method" value={M.storage_method} onChange={(v) => sub('maturation', 'storage_method', v)} rows={2} />
          </>)}

          {step === 7 && (<>
            <h2 className="section-title">Characteristics & profile</h2>
            <p className="text-sm text-mute">Your own opinion, 1–5. Leave blank anything you haven’t judged. The community adds its own results separately.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([['strength', 'Strength'], ['sweetness', 'Sweetness'], ['flavour_intensity', 'Flavour intensity'], ['cooling', 'Cooling'], ['cloud', 'Cloud production'], ['heat_tolerance', 'Heat tolerance'], ['difficulty', 'Difficulty to make']] as const).map(([key, l]) => <Scale5 key={key} label={l} value={C[key]} onChange={(v) => sub('characteristics', key, v)} />)}
            </div>
            <fieldset><legend className="label">Flavour profiles</legend><div className="flex flex-wrap gap-2">{catalog.profiles.map((p) => { const on = draft.profile_slugs?.includes(p.slug); return (
              <button type="button" key={p.slug} aria-pressed={on} onClick={() => set('profile_slugs', on ? draft.profile_slugs!.filter((x) => x !== p.slug) : [...(draft.profile_slugs ?? []), p.slug])} className={cn('chip py-1.5 text-sm', on && 'chip-amber')}>{p.name}</button>); })}</div></fieldset>
            <TagInput label="Tags" value={draft.tags ?? []} suggestions={catalog.tags} onChange={(v) => set('tags', v)} />
          </>)}

          {step === 8 && (<>
            <h2 className="section-title">Sources</h2>
            <p className="text-sm text-mute">Where did the ideas come from? Link to the original (an article, a thread, a video) or upload a file. <strong>Links to shops or pages whose purpose is selling tobacco aren’t allowed.</strong></p>
            <SortableList items={draft.sources as Row<Obj>[]} onChange={(v) => set('sources', v)} itemLabel={(x, i) => s(x.title) || `source ${i + 1}`} renderItem={(src, i) => {
              const up = (key: string, v: unknown) => patch((d) => ({ ...d, sources: d.sources.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }));
              const e = (key: string) => err(`sources.${i}.${key}`);
              const isFile = !!s(src.file_path) || src._mode === 'file';
              return (<div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-4"><Text label="Title" value={src.title} onChange={(v) => up('title', v)} />{e('title') && <p role="alert" className="text-xs text-danger">{e('title')}</p>}</div>
                <div className="sm:col-span-2"><Select label="Type" value={src.source_type ?? 'website'} onChange={(v) => up('source_type', v)} options={SOURCE_TYPES.map((t) => [t, SOURCE_TYPE_LABELS[t]])} /></div>
                <div className="sm:col-span-6 flex gap-4 text-sm"><label className="inline-flex items-center gap-2"><input type="radio" name={`mode-${src._k}`} checked={!isFile} onChange={() => { up('_mode', 'link'); up('file_path', null); up('file_mime', null); }} />External link</label><label className="inline-flex items-center gap-2"><input type="radio" name={`mode-${src._k}`} checked={isFile} onChange={() => { up('_mode', 'file'); up('url', null); }} />Uploaded file</label></div>
                {!isFile ? <div className="sm:col-span-6"><Text label="URL" type="url" value={src.url} onChange={(v) => up('url', v)} placeholder="https://…" />{e('url') && <p role="alert" className="text-xs text-danger">{e('url')}</p>}</div>
                  : <div className="sm:col-span-6"><FileUploader kind="source" label="File (JPG, PNG, WebP or PDF)" accept="image/jpeg,image/png,image/webp,application/pdf" value={s(src.file_path) || null} onUploaded={(f) => { up('file_path', f.path); up('file_mime', f.mime); }} onClear={() => { up('file_path', null); up('file_mime', null); }} hint="Stored privately; opened through a short-lived link." /></div>}
                <div className="sm:col-span-4"><Text label="Note (optional)" value={src.description} onChange={(v) => up('description', v)} /></div>
                <div className="sm:col-span-2"><Text label="Accessed on" type="date" value={src.accessed_on} onChange={(v) => up('accessed_on', v)} /></div>
              </div>);
            }} />
            <button type="button" className="btn" onClick={() => set('sources', [...draft.sources, { _k: k(), source_type: 'website', title: '' }])}><Plus size={16} aria-hidden /> Add source</button>
          </>)}

          {step === 9 && (<>
            <h2 className="section-title">Notes & media</h2>
            <FileUploader kind="cover" label="Cover image" accept="image/jpeg,image/png,image/webp" value={s(draft.cover_image_path) || null} onUploaded={(f) => set('cover_image_path', f.path)} onClear={() => set('cover_image_path', null)} hint={`JPG, PNG or WebP, up to ${maxImageMb} MB. Wide images (16:10) look best.`} />
            <Area label="Creator notes (Markdown supported)" value={draft.creator_notes} onChange={(v) => set('creator_notes', v)} rows={6} hint="Tips, what you’d change, things to watch for." />
            <TagInput label="Equipment used" value={draft.equipment ?? []} onChange={(v) => set('equipment', v)} free />
          </>)}

          {step === 10 && (<>
            <h2 className="section-title">Review & publish</h2>
            <div className="card space-y-2 p-4 text-sm">
              <p><strong>{draft.title || 'Untitled recipe'}</strong> — {draft.aromas.length} aroma{draft.aromas.length === 1 ? '' : 's'}, {draft.base.length} base ingredient{draft.base.length === 1 ? '' : 's'}, {draft.steps.length} step{draft.steps.length === 1 ? '' : 's'}, {draft.sources.length} source{draft.sources.length === 1 ? '' : 's'}.</p>
              <p className="text-mute">Visibility: <strong className="text-ink">{draft.visibility}</strong>. Completeness: <strong className="text-ink">{meter.score}%</strong>.</p>
              {meter.hints.length > 0 && <details><summary className="cursor-pointer text-amber">How to improve completeness</summary><ul className="mt-2 list-disc pl-5 text-mute">{meter.hints.map((h) => <li key={h}>{h}</li>)}</ul></details>}
            </div>
            {blockers.length > 0 && <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm"><p className="font-medium text-danger">Before you can publish:</p><ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>}
            {recipeStatus === 'published' && (<>
              <Area label="What changed in this version? (required)" value={changeNotes} onChange={setChangeNotes} rows={3} max={2000} />
              <Select label="Version bump" value={bump} onChange={(v) => setBump(v as 'minor' | 'major')} options={[['minor', `Minor (e.g. ${version || 'v1.0'} → small tweak)`], ['major', 'Major (significant change to the recipe)']]} />
            </>)}
            <p className="text-xs text-mute">By publishing you confirm this is your own documentation of an experiment and that it contains no links to places that sell tobacco. It is a community experience, not a safety guarantee. Past versions stay in the history.</p>
            {pubMsg && <p role="alert" className={pubMsg.ok ? 'text-moss' : 'text-danger'}>{pubMsg.text}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={pub || blockers.length > 0} onClick={doPublish}>{pub ? 'Publishing…' : recipeStatus === 'published' ? 'Publish new version' : 'Publish recipe'}</button>
              {recipeStatus !== 'published' && <button type="button" className="btn" onClick={async () => { await save(); router.push('/me?tab=drafts'); }}>Save as draft & exit</button>}
              {slug && recipeStatus === 'published' && <Link className="btn" href={`/recipes/${slug}`}>Cancel</Link>}
            </div>
          </>)}

          <div className="flex justify-between border-t border-line pt-4">
            <button type="button" className="btn" disabled={step === 1} onClick={() => void go(step - 1)}>← Back</button>
            {step < 10 && <button type="button" className="btn btn-primary" onClick={() => void go(step + 1)}>Next →</button>}
          </div>
        </section>

        <aside aria-label="Live preview" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4"><h2 className="font-display text-lg">Composition preview</h2>
            {preview ? (<dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-mute">Tobacco</dt><dd className="text-right tabular-nums">{formatPct(preview.composition.tobacco_pct)}</dd>
              <dt className="text-mute">Glycerin</dt><dd className="text-right tabular-nums">{formatPct(preview.composition.glycerin_pct)}</dd>
              <dt className="text-mute">Sweeteners</dt><dd className="text-right tabular-nums">{formatPct(preview.composition.sweetener_pct)}</dd>
              <dt className="text-mute">Aromas</dt><dd className="text-right tabular-nums">{formatPct(preview.composition.aroma_pct)}</dd>
            </dl>) : <p className="mt-2 text-sm text-mute">Enter the dry tobacco weight to see a live composition.</p>}
            {preview?.has_unconvertible && <p className="mt-2 text-xs text-amber">Some rows have no reliable mass yet, so these figures are approximate.</p>}
            {preview?.warnings.map((w) => <p key={w} className="mt-1 text-xs text-amber">{w}</p>)}
          </div>
          <p className="text-xs text-mute">Your draft is private until you publish. Autosave keeps it safe if you close the tab.</p>
        </aside>
      </div>
    </div>
  );
}

function TagInput({ label, value, onChange, suggestions = [], free }: { label: string; value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; free?: boolean }) {
  const [text, setText] = useState('');
  const id = useMemo(() => `t${Math.random().toString(36).slice(2, 8)}`, []);
  const add = () => {
    const raw = text.trim(); if (!raw) return;
    const v = free ? raw.slice(0, 80) : raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (v && !value.includes(v) && value.length < 12) onChange([...value, v]);
    setText('');
  };
  return (
    <div><label className="label" htmlFor={id}>{label}</label>
      <div className="flex gap-2"><input id={id} className="field" list={`${id}-l`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} /><button type="button" className="btn" onClick={add}>Add</button></div>
      <datalist id={`${id}-l`}>{suggestions.map((t) => <option key={t} value={t} />)}</datalist>
      <ul className="mt-2 flex flex-wrap gap-1.5">{value.map((t) => <li key={t} className="chip">{t}<button type="button" aria-label={`Remove ${t}`} className="ml-1 text-mute hover:text-ink" onClick={() => onChange(value.filter((x) => x !== t))}>×</button></li>)}</ul>
    </div>
  );
}
