import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchCards } from '@/lib/queries/recipes';
import { formatDate, formatVersion, timeAgo } from '@/lib/utils';
import { Tabs } from '@/components/ui/Tabs';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { RatingStars } from '@/components/ui/RatingStars';
import { EmptyState } from '@/components/ui/EmptyState';
import { MyRecipeActions } from '@/components/dashboard/MyRecipeActions';
import { CollectionsManager, type CollectionVM } from '@/components/dashboard/CollectionsManager';
import { ExperimentActions } from '@/components/dashboard/ExperimentActions';

export const metadata: Metadata = { title: 'My dashboard', robots: { index: false } };

interface MyRecipe { id: string; slug: string; title: string; status: string; visibility: string; moderation: string; version_major: number; version_minor: number; updated_at: string; completeness: number; view_count: number; like_count: number; save_count: number; made_count: number; comment_count: number; review_count: number; rating_sum: number }

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return <svg viewBox={`0 0 ${values.length * 4} 20`} className="h-5 w-24" role="img" aria-label={`Views over the last ${values.length} days, peak ${max}`}>{values.map((v, i) => <rect key={i} x={i * 4} y={20 - (v / max) * 20} width="3" height={(v / max) * 20} className="fill-amber/70" />)}</svg>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireViewer('/me');
  const tab = (await searchParams).tab ?? 'overview';
  const supabase = await createClient();
  const uid = viewer.id;

  const { data: recipeRows } = await supabase.from('recipes')
    .select('id, slug, title, status, visibility, moderation, version_major, version_minor, updated_at, completeness, view_count, like_count, save_count, made_count, comment_count, review_count, rating_sum')
    .eq('creator_id', uid).order('updated_at', { ascending: false });
  const mine = (recipeRows ?? []) as MyRecipe[];
  const drafts = mine.filter((r) => r.status === 'draft');
  const live = mine.filter((r) => r.status !== 'draft');

  const tabs = [
    { key: 'overview', label: 'Overview' }, { key: 'recipes', label: 'My recipes', count: live.length }, { key: 'drafts', label: 'Drafts', count: drafts.length },
    { key: 'saved', label: 'Saved' }, { key: 'liked', label: 'Liked' }, { key: 'collections', label: 'Collections' }, { key: 'made', label: 'My results' }, { key: 'reviews', label: 'My ratings' },
    { key: 'analytics', label: 'Analytics' },
  ];
  const current = tabs.some((t) => t.key === tab) ? tab : 'overview';
  let body: React.ReactNode = null;

  if (current === 'overview') {
    const [{ count: unread }, { count: made }, { count: saved }] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null),
      supabase.from('recipe_experiments').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('recipe_saves').select('recipe_id', { count: 'exact', head: true }).eq('user_id', uid),
    ]);
    const totals = live.reduce((a, r) => ({ views: a.views + r.view_count, likes: a.likes + r.like_count, made: a.made + r.made_count }), { views: 0, likes: 0, made: 0 });
    body = (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['Recipes published', live.filter((r) => r.status === 'published').length], ['Drafts', drafts.length], ['Saved recipes', saved ?? 0], ['Results logged', made ?? 0]].map(([l, v]) => <div key={l as string} className="card p-4"><p className="font-display text-3xl text-amber">{v}</p><p className="text-xs uppercase tracking-wider text-mute">{l}</p></div>)}
        </div>
        <div className="flex flex-wrap gap-3"><Link href="/create" className="btn btn-primary">Create a recipe</Link><Link href="/notifications" className="btn">Notifications{unread ? ` (${unread})` : ''}</Link><Link href={`/u/${viewer.profile.username}`} className="btn">View public profile</Link></div>
        <p className="text-sm text-mute">Across your recipes: {totals.views.toLocaleString('en-GB')} views, {totals.likes} likes, made {totals.made} times by others.</p>
        {drafts.length > 0 && <section><h2 className="section-title mb-2">Continue where you left off</h2><ul className="space-y-2">{drafts.slice(0, 3).map((d) => <li key={d.id} className="card flex items-center justify-between gap-3 p-3"><span>{d.title}<span className="ml-2 text-xs text-mute">{d.completeness}% complete · {timeAgo(d.updated_at)}</span></span><Link className="btn btn-sm" href={`/recipes/${d.slug}/edit`}>Continue</Link></li>)}</ul></section>}
      </div>
    );
  } else if (current === 'recipes' || current === 'drafts') {
    const list = current === 'drafts' ? drafts : live;
    body = list.length ? (
      <ul className="space-y-3">{list.map((r) => (
        <li key={r.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div><Link href={r.status === 'draft' ? `/recipes/${r.slug}/edit` : `/recipes/${r.slug}`} className="font-display text-lg hover:text-amber">{r.title}</Link>
              <p className="text-xs text-mute"><span className="chip py-0 capitalize">{r.status}</span> {r.status !== 'draft' && <>· {formatVersion(r.version_major, r.version_minor)} · {r.visibility}</>} · {r.completeness}% complete · updated {timeAgo(r.updated_at)}{r.moderation !== 'visible' && <span className="ml-2 text-danger">· {r.moderation} by a moderator</span>}</p></div>
            {r.status !== 'draft' && <p className="text-xs text-mute">{r.view_count} views · {r.like_count} likes · {r.save_count} saves · made {r.made_count}× · {r.review_count} ratings</p>}
          </div>
          <MyRecipeActions id={r.id} slug={r.slug} status={r.status} visibility={r.visibility} />
        </li>))}</ul>
    ) : <EmptyState title={current === 'drafts' ? 'No drafts' : 'No published recipes yet'} body="Recipes autosave as drafts while you build them." action={{ href: '/create', label: 'Create a recipe' }} />;
  } else if (current === 'saved' || current === 'liked') {
    const table = current === 'saved' ? 'recipe_saves' : 'recipe_likes';
    const { data } = await supabase.from(table).select('recipe_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(60);
    const cards = await fetchCards((data ?? []).map((x: { recipe_id: string }) => x.recipe_id));
    body = (<div className="space-y-4">
      {current === 'saved' && <p className="text-sm text-mute">Saved recipes are your private bookmarks. {viewer.profile.show_saved ? 'They are currently visible on your profile.' : 'They are hidden from your profile.'} <Link className="text-amber underline" href="/settings">Change in settings</Link>.</p>}
      {cards.length ? <RecipeGrid items={cards} /> : <EmptyState title={`No ${current} recipes`} body="Use the buttons on any recipe page." action={{ href: '/recipes', label: 'Browse recipes' }} />}</div>);
  } else if (current === 'collections') {
    const [{ data: cols }, { data: saves }] = await Promise.all([
      supabase.from('collections').select('id, name, collection_recipes(recipes(id, slug, title))').eq('user_id', uid).order('created_at'),
      supabase.from('recipe_saves').select('recipes(id, title)').eq('user_id', uid).limit(200),
    ]);
    const collections: CollectionVM[] = ((cols ?? []) as unknown as { id: string; name: string; collection_recipes: { recipes: { id: string; slug: string; title: string } | null }[] }[])
      .map((c) => ({ id: c.id, name: c.name, recipes: c.collection_recipes.map((x) => x.recipes).filter((x): x is { id: string; slug: string; title: string } => !!x) }));
    const saved = ((saves ?? []) as unknown as { recipes: { id: string; title: string } | null }[]).map((s) => s.recipes).filter((x): x is { id: string; title: string } => !!x);
    body = <CollectionsManager collections={collections} saved={saved} />;
  } else if (current === 'made') {
    const { data } = await supabase.from('recipe_experiments').select('id, made_on, overall, visibility, moderation, version_major, version_minor, would_make_again, recipes(slug, title)').eq('user_id', uid).order('made_on', { ascending: false }).limit(100);
    const rows = (data ?? []) as unknown as { id: string; made_on: string; overall: number; visibility: string; moderation: string; version_major: number; version_minor: number; would_make_again: string; recipes: { slug: string; title: string } | null }[];
    body = rows.length ? <ul className="space-y-3">{rows.map((e) => <li key={e.id} className="card space-y-2 p-4"><div className="flex flex-wrap items-center gap-3"><Link className="font-display text-lg hover:text-amber" href={`/recipes/${e.recipes?.slug}`}>{e.recipes?.title}</Link><RatingStars value={e.overall} showValue={false} /><span className="text-xs text-mute">{formatDate(e.made_on)} · v{e.version_major}.{e.version_minor} · make again: {e.would_make_again}{e.moderation !== 'visible' && ' · removed by a moderator'}</span></div><ExperimentActions id={e.id} visibility={e.visibility} /></li>)}</ul>
      : <EmptyState title="No results logged" body="Open any recipe and press “I made this” to log how it went." action={{ href: '/recipes', label: 'Find a recipe' }} />;
  } else if (current === 'reviews') {
    const { data } = await supabase.from('recipe_reviews').select('id, overall, body, created_at, recipes(slug, title)').eq('user_id', uid).order('created_at', { ascending: false }).limit(100);
    const rows = (data ?? []) as unknown as { id: string; overall: number; body: string | null; created_at: string; recipes: { slug: string; title: string } | null }[];
    body = rows.length ? <ul className="space-y-3">{rows.map((r) => <li key={r.id} className="card p-4"><div className="flex flex-wrap items-center gap-3"><Link className="font-display text-lg hover:text-amber" href={`/recipes/${r.recipes?.slug}#reviews`}>{r.recipes?.title}</Link><RatingStars value={r.overall} showValue={false} /><span className="text-xs text-mute">{timeAgo(r.created_at)}</span></div>{r.body && <p className="mt-1 text-sm text-mute">{r.body.slice(0, 200)}</p>}</li>)}</ul> : <EmptyState title="You haven’t rated any recipes" />;
  } else if (current === 'analytics') {
    const { data } = await supabase.rpc('creator_view_series', { p_days: 30 });
    const series = new Map<string, Map<string, number>>();
    for (const row of (data ?? []) as { recipe_id: string; day: string; views: number }[]) { if (!series.has(row.recipe_id)) series.set(row.recipe_id, new Map()); series.get(row.recipe_id)!.set(row.day, row.views); }
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
    const pub = live.filter((r) => r.status === 'published');
    body = pub.length ? (
      <div className="space-y-3">
        <p className="text-sm text-mute">Aggregate numbers only — we don’t record who viewed, liked or saved your recipes.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-mute"><th className="py-2 pr-3 font-medium">Recipe</th><th className="px-2 font-medium">30-day views</th><th className="px-2 text-right font-medium">Views</th><th className="px-2 text-right font-medium">Likes</th><th className="px-2 text-right font-medium">Saves</th><th className="px-2 text-right font-medium">Made</th><th className="px-2 text-right font-medium">Comments</th><th className="pl-2 text-right font-medium">Rating</th></tr></thead>
          <tbody>{pub.map((r) => { const s = series.get(r.id); return <tr key={r.id} className="border-b border-line/50"><th scope="row" className="py-2 pr-3 text-left font-normal"><Link className="hover:text-amber" href={`/recipes/${r.slug}`}>{r.title}</Link></th><td className="px-2"><Spark values={days.map((d) => s?.get(d) ?? 0)} /></td><td className="px-2 text-right tabular-nums">{r.view_count}</td><td className="px-2 text-right tabular-nums">{r.like_count}</td><td className="px-2 text-right tabular-nums">{r.save_count}</td><td className="px-2 text-right tabular-nums">{r.made_count}</td><td className="px-2 text-right tabular-nums">{r.comment_count}</td><td className="pl-2 text-right tabular-nums">{r.review_count ? (r.rating_sum / r.review_count).toFixed(1) : '—'}</td></tr>; })}</tbody></table></div>
      </div>) : <EmptyState title="Nothing to analyse yet" body="Publish a recipe and its numbers will show up here." />;
  }

  return (
    <div className="container py-8">
      <h1 className="font-display text-3xl">Hello, {viewer.profile.display_name || viewer.profile.username}</h1>
      <div className="mt-4"><Tabs label="Dashboard sections" tabs={tabs} current={current} hrefFor={(k) => `/me${k === 'overview' ? '' : `?tab=${k}`}`} /></div>
      <div className="mt-6">{body}</div>
    </div>
  );
}
