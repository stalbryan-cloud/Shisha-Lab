import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutGrid, List, FlaskConical, X } from 'lucide-react';
import { activeFilterCount, parseRecipeFilters, serializeRecipeFilters, PAGE_SIZE, type RecipeFilters as F } from '@/lib/core/filters';
import { listRecipes } from '@/lib/queries/recipes';
import { getFilterOptions } from '@/lib/queries/filter-options';
import { getViewer } from '@/lib/auth';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { FilterDrawer } from '@/components/recipe/FilterDrawer';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const f = parseRecipeFilters(await searchParams);
  const filtered = activeFilterCount(f) > 0 || f.q || f.page > 1;
  return { title: f.q ? `Recipes matching “${f.q}”` : 'Recipes', description: 'Browse community shisha tobacco recipes with detailed ingredients, process notes, ratings and results.',
    alternates: { canonical: '/recipes' }, robots: filtered ? { index: false, follow: true } : undefined };
}

function chips(f: F): { label: string; without: Partial<F> }[] {
  const out: { label: string; without: Partial<F> }[] = [];
  const multi = (key: 'family' | 'leaf' | 'brand' | 'origin' | 'sweetener' | 'aromaBrand' | 'flavour' | 'profile' | 'have', title: string) =>
    f[key].forEach((v) => out.push({ label: `${title}: ${v.replace(/[-_]/g, ' ')}`, without: { [key]: f[key].filter((x) => x !== v) } }));
  multi('family', 'Family'); multi('leaf', 'Leaf'); multi('brand', 'Brand'); multi('origin', 'Origin'); multi('sweetener', 'Sweetener');
  multi('aromaBrand', 'Aroma brand'); multi('flavour', 'Flavour'); multi('profile', 'Profile'); multi('have', 'Have');
  if (f.washed) out.push({ label: f.washed === 'yes' ? 'Washed' : 'Not washed', without: { washed: null } });
  if (f.strength) out.push({ label: `Strength ${f.strength.join('–')}`, without: { strength: null } });
  if (f.intensity) out.push({ label: `Intensity ${f.intensity.join('–')}`, without: { intensity: null } });
  if (f.sweetness) out.push({ label: `Sweetness ${f.sweetness.join('–')}`, without: { sweetness: null } });
  if (f.rest) out.push({ label: `Rest ${f.rest}`, without: { rest: null } });
  if (f.minRating) out.push({ label: `${f.minRating}★+`, without: { minRating: null } });
  if (f.minReviews) out.push({ label: `${f.minReviews}+ ratings`, without: { minReviews: null } });
  if (f.since) out.push({ label: `Published ${f.since}`, without: { since: null } });
  if (f.tested) out.push({ label: 'Community Tested', without: { tested: false } });
  return out;
}

export default async function RecipesPage({ searchParams }: { searchParams: SP }) {
  const f = parseRecipeFilters(await searchParams);
  const [result, options, viewer] = await Promise.all([listRecipes(f), getFilterOptions(), getViewer()]);
  const href = (over: Partial<F>) => { const s = serializeRecipeFilters({ ...f, ...over }); return `/recipes${s ? `?${s}` : ''}`; };
  const n = activeFilterCount(f);
  const active = chips(f);
  const filtersUi = (idPrefix: string) => <RecipeFilters filters={f} options={options} idPrefix={idPrefix} signedIn={!!viewer} />;
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{f.q ? <>Recipes matching “{f.q}”</> : 'Recipes'}</h1>
          <p className="text-sm text-mute" aria-live="polite">{result.total.toLocaleString('en-GB')} {result.total === 1 ? 'recipe' : 'recipes'}{n > 0 && ` · ${n} filter${n === 1 ? '' : 's'} active`}</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterDrawer count={n}>{filtersUi('m')}</FilterDrawer>
          <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-md border border-line">
            <Link href={href({ view: 'grid', page: 1 })} aria-label="Grid view" aria-current={f.view === 'grid'} className={`flex min-h-10 items-center px-3 ${f.view === 'grid' ? 'bg-amber text-bg' : 'bg-surface hover:bg-raised'}`}><LayoutGrid size={16} /></Link>
            <Link href={href({ view: 'list', page: 1 })} aria-label="List view" aria-current={f.view === 'list'} className={`flex min-h-10 items-center px-3 ${f.view === 'list' ? 'bg-amber text-bg' : 'bg-surface hover:bg-raised'}`}><List size={16} /></Link>
          </div>
        </div>
      </div>

      {active.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
          {active.map((c) => <li key={c.label}><Link href={href({ ...c.without, page: 1 })} className="chip chip-amber hover:bg-amber/20">{c.label}<X size={12} aria-label="Remove filter" /></Link></li>)}
          <li><Link href={f.q ? `/recipes?q=${encodeURIComponent(f.q)}` : '/recipes'} className="chip">Clear all</Link></li>
        </ul>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters"><div className="card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-auto p-4">{filtersUi('d')}</div></aside>
        <section aria-label="Results">
          {result.items.length === 0 ? (
            <EmptyState icon={<FlaskConical size={36} />} title="No recipes match" body={n || f.q ? 'Try removing a filter or searching with fewer words. Synonyms and typos are handled for you.' : 'No recipes have been published yet.'}
              action={n || f.q ? { href: '/recipes', label: 'Clear filters' } : { href: '/create', label: 'Create the first recipe' }} />
          ) : <RecipeGrid items={result.items} view={f.view} />}
          <Pagination page={f.page} pageSize={PAGE_SIZE} total={result.total} hrefFor={(p) => href({ page: p })} />
        </section>
      </div>
    </div>
  );
}
