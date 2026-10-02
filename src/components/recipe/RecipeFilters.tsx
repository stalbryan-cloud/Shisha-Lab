import Link from 'next/link';
import { FAMILIES, REST_BUCKETS, SINCE_OPTIONS, SORTS, SORT_LABELS, SWEETENER_CATEGORIES, type RecipeFilters as F } from '@/lib/core/filters';
import type { Facet } from '@/lib/queries/recipes';

const REST_LABEL: Record<string, string> = { lt24: 'Under 24 h', '24-72': '1–3 days', '72-168': '3–7 days', gt168: 'Over a week' };
const SINCE_LABEL: Record<string, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '365d': 'Last year' };
const SWEET_LABEL: Record<string, string> = { honey: 'Honey', molasses: 'Molasses', invert_syrup: 'Invert syrup', glucose_syrup: 'Glucose syrup' };
const RANGES = ['1-2', '2-3', '3-4', '4-5', '1-3', '3-5'];

function Group({ legend, children, open }: { legend: string; children: React.ReactNode; open?: boolean }) {
  return <details open={open} className="border-b border-line py-3"><summary className="cursor-pointer select-none text-sm font-medium">{legend}</summary><div className="mt-2 space-y-1.5">{children}</div></details>;
}
function Checks({ name, options, selected, idp }: { name: string; options: { value: string; label: string; count?: number }[]; selected: string[]; idp: string }) {
  return <div className="max-h-48 space-y-1 overflow-auto pr-1">{options.map((o) => (
    <label key={o.value} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} id={`${idp}-${name}-${o.value}`} /><span>{o.label}</span>{o.count != null && <span className="ml-auto text-xs text-mute">{o.count}</span>}</label>
  ))}</div>;
}
function RangeSelect({ name, label, value, idp }: { name: string; label: string; value: [number, number] | null; idp: string }) {
  return <div><label className="label" htmlFor={`${idp}-${name}`}>{label}</label><select id={`${idp}-${name}`} name={name} className="field" defaultValue={value ? `${value[0]}-${value[1]}` : ''}><option value="">Any</option>{RANGES.map((r) => <option key={r} value={r}>{r.replace('-', ' to ')}</option>)}</select></div>;
}

export interface FilterOptions {
  flavours: Facet[]; profiles: Facet[]; leafTypes: Facet[]; origins: Facet[]; aromaBrands: Facet[]; tobaccoBrands: { slug: string; name: string }[]; aromas: { slug: string; name: string }[];
}

/** Plain GET form: filters live in the URL, work without JavaScript, and are shareable. Rendered in the sidebar and in the mobile bottom sheet. */
export function RecipeFilters({ filters: f, options: o, idPrefix = 'f', signedIn }: { filters: F; options: FilterOptions; idPrefix?: string; signedIn: boolean }) {
  const idp = idPrefix;
  return (
    <form method="get" action="/recipes" className="space-y-1">
      {f.q && <input type="hidden" name="q" value={f.q} />}
      {f.view === 'list' && <input type="hidden" name="view" value="list" />}
      <div className="pb-3"><label className="label" htmlFor={`${idp}-sort`}>Sort by</label>
        <select id={`${idp}-sort`} name="sort" className="field" defaultValue={f.sort}>{SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}</select></div>
      <Group legend="Tobacco" open>
        <p className="text-xs uppercase tracking-wider text-mute">Leaf family</p>
        <Checks idp={idp} name="family" selected={f.family} options={FAMILIES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} />
        {o.leafTypes.length > 0 && <><p className="pt-2 text-xs uppercase tracking-wider text-mute">Leaf type</p><Checks idp={idp} name="leaf" selected={f.leaf} options={o.leafTypes.map((x) => ({ value: x.slug!, label: x.name, count: x.count }))} /></>}
        {o.tobaccoBrands.length > 0 && <><p className="pt-2 text-xs uppercase tracking-wider text-mute">Manufacturer</p><Checks idp={idp} name="brand" selected={f.brand} options={o.tobaccoBrands.map((x) => ({ value: x.slug, label: x.name }))} /></>}
        {o.origins.length > 0 && <><p className="pt-2 text-xs uppercase tracking-wider text-mute">Origin</p><Checks idp={idp} name="origin" selected={f.origin} options={o.origins.map((x) => ({ value: x.name, label: x.name, count: x.count }))} /></>}
        <div><label className="label" htmlFor={`${idp}-washed`}>Washed</label><select id={`${idp}-washed`} name="washed" className="field" defaultValue={f.washed ?? ''}><option value="">Any</option><option value="yes">Washed</option><option value="no">Not washed</option></select></div>
      </Group>
      <Group legend="Flavours & aromas">
        <p className="text-xs uppercase tracking-wider text-mute">Contains flavour (all selected)</p>
        <Checks idp={idp} name="flavour" selected={f.flavour} options={o.flavours.map((x) => ({ value: x.slug!, label: x.name, count: x.count }))} />
        <p className="pt-2 text-xs uppercase tracking-wider text-mute">Aroma brand</p>
        <Checks idp={idp} name="aromaBrand" selected={f.aromaBrand} options={o.aromaBrands.map((x) => ({ value: x.slug!, label: x.name, count: x.count }))} />
      </Group>
      <Group legend="Flavour profile"><Checks idp={idp} name="profile" selected={f.profile} options={o.profiles.map((x) => ({ value: x.slug!, label: x.name, count: x.count }))} /></Group>
      <Group legend="Base">
        <Checks idp={idp} name="sweetener" selected={f.sweetener} options={SWEETENER_CATEGORIES.map((x) => ({ value: x, label: SWEET_LABEL[x] }))} />
      </Group>
      <Group legend="Characteristics (creator’s view)">
        <RangeSelect idp={idp} name="strength" label="Strength" value={f.strength} />
        <RangeSelect idp={idp} name="intensity" label="Flavour intensity" value={f.intensity} />
        <RangeSelect idp={idp} name="sweetness" label="Sweetness" value={f.sweetness} />
        <div><label className="label" htmlFor={`${idp}-rest`}>Recommended rest</label><select id={`${idp}-rest`} name="rest" className="field" defaultValue={f.rest ?? ''}><option value="">Any</option>{REST_BUCKETS.map((r) => <option key={r} value={r}>{REST_LABEL[r]}</option>)}</select></div>
      </Group>
      <Group legend="Community">
        <div><label className="label" htmlFor={`${idp}-minRating`}>Minimum rating</label><select id={`${idp}-minRating`} name="minRating" className="field" defaultValue={f.minRating ?? ''}><option value="">Any</option>{[2, 3, 4].map((n) => <option key={n} value={n}>{n}★ and up</option>)}</select></div>
        <div><label className="label" htmlFor={`${idp}-minReviews`}>Minimum ratings</label><select id={`${idp}-minReviews`} name="minReviews" className="field" defaultValue={f.minReviews ?? ''}><option value="">Any</option>{[3, 5, 10, 25].map((n) => <option key={n} value={n}>{n}+</option>)}</select></div>
        <div><label className="label" htmlFor={`${idp}-since`}>Published</label><select id={`${idp}-since`} name="since" className="field" defaultValue={f.since ?? ''}><option value="">Any time</option>{SINCE_OPTIONS.map((s) => <option key={s} value={s}>{SINCE_LABEL[s]}</option>)}</select></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="tested" value="1" defaultChecked={f.tested} /> Community Tested only</label>
      </Group>
      <Group legend="Recipes I can make" open={f.have.length > 0}>
        <p className="text-xs text-mute">Tick the aromas you have. We’ll show recipes that need only those aromas. This is just a filter — nothing is stored.</p>
        <Checks idp={idp} name="have" selected={f.have} options={o.aromas.map((a) => ({ value: a.slug, label: a.name }))} />
      </Group>
      <div className="sticky bottom-0 flex gap-2 bg-surface pt-3">
        <button className="btn btn-primary flex-1">Apply filters</button>
        <Link href={f.q ? `/recipes?q=${encodeURIComponent(f.q)}` : '/recipes'} className="btn">Reset</Link>
      </div>
    </form>
  );
}
