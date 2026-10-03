import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { communityPicks, communityStats, isTrendingWindow, listRecipes, popularProfiles, trendingRecipes, TRENDING_LABELS, type TrendingWindow } from '@/lib/queries/recipes';
import { activeDiscussions } from '@/lib/queries/forum';
import { DEFAULT_FILTERS } from '@/lib/core/filters';
import { SearchAutocomplete } from '@/components/layout/SearchAutocomplete';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { ForumTopicRow } from '@/components/forum/ForumTopicRow';
import { formatHours } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { JarStack } from '@/components/recipe/JarStack';

export const revalidate = 120;
const QUICK = ['Peach', 'Mint', 'Berry', 'Citrus', 'Creamy', 'Dessert', 'Tropical', 'Cooling'];

function Section({ id, title, href, children, right }: { id: string; title: string; href?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><h2 id={id} className="section-title">{title}</h2>{right}{href && <Link href={href} className="text-sm text-amber hover:underline">See all →</Link>}</div>
      {children}
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const w = (await searchParams).window;
  const window: TrendingWindow = isTrendingWindow(w) ? w : 'week';
  const base = { ...DEFAULT_FILTERS };
  const [trending, topRated, mostMade, newest, picks, profiles, topics, stats] = await Promise.all([
    trendingRecipes(window, 6),
    listRecipes({ ...base, sort: 'rating', minReviews: 3 }, { limit: 3 }),
    listRecipes({ ...base, sort: 'made' }, { limit: 3 }),
    listRecipes({ ...base, sort: 'newest' }, { limit: 3 }),
    communityPicks(3),
    popularProfiles(8),
    activeDiscussions(5),
    communityStats(),
  ]);
  const empty = !trending.length && !newest.items.length;
  const jar = trending[0] ?? newest.items[0] ?? null;
  return (
    <div>
      <section className="relative border-b border-line bg-surface/70">
        <div aria-hidden className="absolute inset-y-0 left-4 w-px bg-ember/50 sm:left-10" />
        <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div className="sm:pl-10">
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] sm:text-6xl">Document, test and discuss homemade shisha recipes.</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink/80">A community notebook for experimenters: structured recipes, honest results, and the conversations that improve them. Not a shop.</p>
            <div className="mt-7 max-w-xl"><SearchAutocomplete size="lg" /></div>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quick searches">{QUICK.map((t) => <li key={t}><Link href={`/search?q=${t}`} className="chip hover:border-amber hover:text-amber">{t}</Link></li>)}</ul>
          </div>
          {jar && (
            <Link href={`/recipes/${jar.slug}`} className="group block sm:pl-10 lg:pl-0" aria-label={`Open ${jar.title}`}>
              <JarStack aromas={jar.aromas} variant="jar" />
              <p className="mx-auto mt-4 max-w-sm text-center font-hand text-2xl leading-tight text-ink/80 group-hover:text-amber">{jar.title}{jar.recommended_rest_hours != null ? `, rest ${formatHours(jar.recommended_rest_hours)}` : ''}</p>
            </Link>
          )}
        </div>
      </section>

      <div className="container space-y-14 py-12">
        {empty ? <EmptyState icon={<FlaskConical size={36} />} title="The lab is empty" body="No recipes have been published yet. Add the first one and start the conversation." action={{ href: '/create', label: 'Create a recipe' }} /> : (<>
          <Section id="h-trend" title="Trending" href="/recipes?sort=trending" right={
            <nav aria-label="Trending period" className="flex flex-wrap gap-1">{(Object.keys(TRENDING_LABELS) as TrendingWindow[]).map((k) => <Link key={k} href={k === 'week' ? '/' : `/?window=${k}`} aria-current={k === window ? 'true' : undefined} scroll={false} className={`rounded-md px-3 py-1.5 text-sm ${k === window ? 'bg-amber text-bg' : 'text-mute hover:bg-raised'}`}>{TRENDING_LABELS[k]}</Link>)}</nav>}>
            {trending.length ? <RecipeGrid items={trending} /> : <p className="text-sm text-mute">Nothing trending in this period yet.</p>}
          </Section>
          {picks.length > 0 && <Section id="h-picks" title="Community picks"><RecipeGrid items={picks} /></Section>}
          <Section id="h-top" title="Top rated" href="/recipes?sort=rating&minReviews=3">{topRated.items.length ? <RecipeGrid items={topRated.items} /> : <p className="text-sm text-mute">Recipes need at least 3 ratings to appear here.</p>}</Section>
          <Section id="h-made" title="Most made" href="/recipes?sort=made"><RecipeGrid items={mostMade.items} /></Section>
          <Section id="h-new" title="New recipes" href="/recipes?sort=newest"><RecipeGrid items={newest.items} /></Section>
        </>)}

        <div className="grid gap-10 lg:grid-cols-2">
          <Section id="h-prof" title="Popular flavour profiles" href="/explore">
            <ul className="flex flex-wrap gap-2">{profiles.map((p) => <li key={p.slug}><Link href={`/recipes?profile=${p.slug}`} className="chip py-1.5 text-sm hover:border-amber/60 hover:text-amber">{p.name}<span className="text-mute">{p.recipe_count}</span></Link></li>)}{!profiles.length && <li className="text-sm text-mute">No profiles yet.</li>}</ul>
          </Section>
          <Section id="h-disc" title="Active discussions" href="/community">
            {topics.length ? <ul className="space-y-2">{topics.map((t) => <ForumTopicRow key={t.id} topic={t} />)}</ul> : <p className="text-sm text-mute">No recent discussions.</p>}
          </Section>
        </div>

        <section aria-label="Community statistics" className="card flex flex-wrap justify-between gap-6 px-6 py-5">
          {([['recipes', 'recipes documented'], ['experiments', 'results logged'], ['members', 'members'], ['discussions', 'discussions']] as const).map(([k, l]) => (
            <div key={k}><p className="font-display text-3xl text-amber">{(stats[k] ?? 0).toLocaleString('en-GB')}</p><p className="text-xs uppercase tracking-wider text-mute">{l}</p></div>
          ))}
        </section>
      </div>
    </div>
  );
}
