import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { communityPicks, communityStats, isTrendingWindow, listRecipes, popularProfiles, trendingRecipes, TRENDING_LABELS, type TrendingWindow } from '@/lib/queries/recipes';
import { activeDiscussions } from '@/lib/queries/forum';
import { DEFAULT_FILTERS } from '@/lib/core/filters';
import { SearchAutocomplete } from '@/components/layout/SearchAutocomplete';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { ForumTopicRow } from '@/components/forum/ForumTopicRow';
import { EmptyState } from '@/components/ui/EmptyState';

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
    listRecipes({ ...base, sort: 'rating', minReviews: 3 }, { limit: 6 }),
    listRecipes({ ...base, sort: 'made' }, { limit: 6 }),
    listRecipes({ ...base, sort: 'newest' }, { limit: 6 }),
    communityPicks(3),
    popularProfiles(8),
    activeDiscussions(5),
    communityStats(),
  ]);
  const empty = !trending.length && !newest.items.length;
  return (
    <div>
      <section className="border-b border-line">
        <div className="container py-14 sm:py-20">
          <p className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-amber"><FlaskConical size={16} aria-hidden /> The flavour laboratory</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">Document, test and discuss homemade shisha recipes.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink/75">A community notebook for experimenters — structured recipes, honest results, and the conversations that improve them. Not a shop.</p>
          <div className="mt-8 max-w-2xl"><SearchAutocomplete size="lg" /></div>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quick searches">{QUICK.map((t) => <li key={t}><Link href={`/search?q=${t}`} className="chip hover:border-amber/60 hover:text-amber">{t}</Link></li>)}</ul>
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
