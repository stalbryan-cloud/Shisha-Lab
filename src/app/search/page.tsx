import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { parseRecipeFilters } from '@/lib/core/filters';
import { listRecipes } from '@/lib/queries/recipes';
import { listTopics } from '@/lib/queries/forum';
import { createClient } from '@/lib/supabase/server';
import { SearchAutocomplete } from '@/components/layout/SearchAutocomplete';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { ForumTopicRow } from '@/components/forum/ForumTopicRow';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

/** Unified search. Recipes rank by text relevance first (then rating/popularity as tie-breakers, inside the SQL function). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = parseRecipeFilters({ q: sp.q });
  const q = f.q;
  const supabase = await createClient();
  const [recipes, topics, aromas, members] = q ? await Promise.all([
    listRecipes({ ...f, sort: 'trending' }, { limit: 12 }),
    listTopics({ q, sort: 'latest' }).then((r) => r.items.slice(0, 5)),
    supabase.rpc('search_autocomplete', { p_q: q, p_per_group: 6 }).then((r) => ((r.data ?? []) as { kind: string; label: string; slug: string }[]).filter((x) => x.kind === 'aroma' || x.kind === 'flavour' || x.kind === 'tobacco')),
    supabase.from('profiles').select('username, display_name, avatar_path').eq('is_anonymized', false).or(`username.ilike.%${q.replace(/[%,()]/g, '')}%,display_name.ilike.%${q.replace(/[%,()]/g, '')}%`).limit(6).then((r) => r.data ?? []),
  ]) : [null, [], [], []] as const;
  const nothing = q && recipes && !recipes.total && !topics.length && !aromas.length && !members.length;
  return (
    <div className="container space-y-8 py-8">
      <div><h1 className="font-display text-3xl">Search</h1><div className="mt-3 max-w-2xl"><SearchAutocomplete size="lg" defaultValue={q} autoFocus={!q} /></div></div>
      {!q && <EmptyState icon={<Search size={32} />} title="Search the lab" body="Try a flavour (“peach”), an aroma name, a technique, or a member. Typos and synonyms like “VG” or “molasses” are understood." />}
      {nothing && <EmptyState icon={<Search size={32} />} title={`Nothing found for “${q}”`} body="Check the spelling, try a more general word, or browse by flavour." action={{ href: '/explore', label: 'Explore flavours' }} />}
      {recipes && recipes.total > 0 && (
        <section aria-labelledby="s-rec"><div className="mb-3 flex items-baseline justify-between"><h2 id="s-rec" className="section-title">Recipes <span className="text-base text-mute">({recipes.total})</span></h2><Link href={`/recipes?q=${encodeURIComponent(q)}`} className="text-sm text-amber hover:underline">All results with filters →</Link></div><RecipeGrid items={recipes.items} /></section>
      )}
      {aromas.length > 0 && <section aria-labelledby="s-ing"><h2 id="s-ing" className="section-title mb-3">Ingredients & flavours</h2><ul className="flex flex-wrap gap-2">{aromas.map((a) => <li key={`${a.kind}-${a.slug}`}><Link className="chip hover:border-amber/60" href={a.kind === 'flavour' ? `/recipes?flavour=${a.slug}` : `/recipes?q=${encodeURIComponent(a.label)}`}>{a.label}<span className="text-mute">{a.kind}</span></Link></li>)}</ul></section>}
      {topics.length > 0 && <section aria-labelledby="s-for"><div className="mb-3 flex items-baseline justify-between"><h2 id="s-for" className="section-title">Forum</h2><Link href={`/community?q=${encodeURIComponent(q)}`} className="text-sm text-amber hover:underline">More →</Link></div><ul className="space-y-2">{topics.map((t) => <ForumTopicRow key={t.id} topic={t} />)}</ul></section>}
      {members.length > 0 && <section aria-labelledby="s-mem"><h2 id="s-mem" className="section-title mb-3">Members</h2><ul className="flex flex-wrap gap-3">{members.map((m) => <li key={m.username}><Link href={`/u/${m.username}`} className="card flex items-center gap-2 px-3 py-2 hover:border-amber/40"><ProfileAvatar profile={m} size={28} /><span className="text-sm">{m.display_name || m.username}</span><span className="text-xs text-mute">@{m.username}</span></Link></li>)}</ul></section>}
    </div>
  );
}
