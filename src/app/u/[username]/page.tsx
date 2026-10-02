import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Globe, MapPin } from 'lucide-react';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchCards, listRecipes } from '@/lib/queries/recipes';
import { listTopics } from '@/lib/queries/forum';
import { DEFAULT_FILTERS } from '@/lib/core/filters';
import { safeUrl, renderMarkdown } from '@/lib/core/markdown';
import { formatDate, timeAgo } from '@/lib/utils';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { Tabs } from '@/components/ui/Tabs';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { RatingStars } from '@/components/ui/RatingStars';
import { ForumTopicRow } from '@/components/forum/ForumTopicRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportDialog } from '@/components/ui/ReportDialog';

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };

async function getProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles')
    .select('id, username, display_name, bio, avatar_path, website, social_links, experience_level, pinned_recipe_id, show_saved, show_likes, show_location, is_anonymized, created_at')
    .eq('username', username.toLowerCase()).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProfile((await params).username);
  if (!p) return { title: 'Member not found' };
  return { title: `${p.display_name || p.username} (@${p.username})`, description: p.bio?.slice(0, 160) ?? `Recipes and results from @${p.username} on SHISHA LAB.`, alternates: { canonical: `/u/${p.username}` } };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const p = await getProfile(username);
  if (!p || p.is_anonymized) notFound();
  const tab = (await searchParams).tab ?? 'recipes';
  const viewer = await getViewer();
  const own = viewer?.id === p.id;
  const supabase = await createClient();

  const [location, recipeCount, madeCount, reviewCount] = await Promise.all([
    supabase.rpc('profile_location', { p_user: p.id }).then((r) => (r.data as string | null) ?? null),
    supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('creator_id', p.id).eq('status', 'published').eq('visibility', 'public').eq('moderation', 'visible').then((r) => r.count ?? 0),
    supabase.from('recipe_experiments').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('visibility', 'public').eq('moderation', 'visible').then((r) => r.count ?? 0),
    supabase.from('recipe_reviews').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('moderation', 'visible').then((r) => r.count ?? 0),
  ]);

  const tabs = [
    { key: 'recipes', label: 'Recipes', count: recipeCount }, { key: 'made', label: 'Made', count: madeCount }, { key: 'reviews', label: 'Reviews', count: reviewCount },
    { key: 'discussions', label: 'Discussions' },
    ...(p.show_saved || own ? [{ key: 'saved', label: 'Saved' }] : []), ...(p.show_likes || own ? [{ key: 'liked', label: 'Liked' }] : []),
  ];
  const current = tabs.some((t) => t.key === tab) ? tab : 'recipes';
  const social = Object.entries((p.social_links ?? {}) as Record<string, string>).filter(([, v]) => v);

  let body: React.ReactNode = null;
  if (current === 'recipes') {
    const r = await listRecipes({ ...DEFAULT_FILTERS, sort: 'newest' }, { creator: p.id, limit: 24 });
    body = r.items.length ? <RecipeGrid items={r.items} /> : <EmptyState title="No public recipes yet" body={own ? 'Publish your first recipe to see it here.' : undefined} action={own ? { href: '/create', label: 'Create a recipe' } : undefined} />;
  } else if (current === 'made') {
    const { data } = await supabase.from('recipe_experiments').select('id, made_on, overall, followed_exactly, would_make_again, notes, version_major, version_minor, recipes(slug, title)')
      .eq('user_id', p.id).eq('visibility', 'public').eq('moderation', 'visible').order('made_on', { ascending: false }).limit(50);
    const rows = (data ?? []) as unknown as { id: string; made_on: string; overall: number; followed_exactly: boolean; would_make_again: string; notes: string | null; version_major: number; version_minor: number; recipes: { slug: string; title: string } | null }[];
    body = rows.length ? <ul className="space-y-3">{rows.map((e) => <li key={e.id} className="card p-4"><div className="flex flex-wrap items-center gap-3"><Link className="font-display text-lg hover:text-amber" href={`/recipes/${e.recipes?.slug}`}>{e.recipes?.title}</Link><RatingStars value={e.overall} showValue={false} /><span className="text-xs text-mute">{formatDate(e.made_on)} · v{e.version_major}.{e.version_minor} · {e.followed_exactly ? 'as written' : 'modified'}</span></div>{e.notes && <div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.notes, { maxLength: 1000 }) }} />}</li>)}</ul>
      : <EmptyState title="Nothing logged yet" body="Public “I made this” results appear here." />;
  } else if (current === 'reviews') {
    const { data } = await supabase.from('recipe_reviews').select('id, overall, body, created_at, maker_status, recipes(slug, title)').eq('user_id', p.id).eq('moderation', 'visible').order('created_at', { ascending: false }).limit(50);
    const rows = (data ?? []) as unknown as { id: string; overall: number; body: string | null; created_at: string; recipes: { slug: string; title: string } | null }[];
    body = rows.length ? <ul className="space-y-3">{rows.map((r) => <li key={r.id} className="card p-4"><div className="flex flex-wrap items-center gap-3"><Link className="font-display text-lg hover:text-amber" href={`/recipes/${r.recipes?.slug}`}>{r.recipes?.title}</Link><RatingStars value={r.overall} showValue={false} /><span className="text-xs text-mute">{timeAgo(r.created_at)}</span></div>{r.body && <div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.body, { maxLength: 1000 }) }} />}</li>)}</ul>
      : <EmptyState title="No reviews yet" />;
  } else if (current === 'discussions') {
    const t = await listTopics({ author: p.id, sort: 'latest' });
    body = t.items.length ? <ul className="space-y-2">{t.items.map((x) => <ForumTopicRow key={x.id} topic={x} />)}</ul> : <EmptyState title="No topics started" />;
  } else if (current === 'saved') {
    const { data } = await supabase.rpc('profile_saved_ids', { p_user: p.id, p_limit: 48 });
    const cards = await fetchCards(((data ?? []) as { recipe_id: string }[]).map((x) => x.recipe_id));
    body = cards.length ? <RecipeGrid items={cards} /> : <EmptyState title="No saved recipes" />;
  } else if (current === 'liked') {
    const { data } = await supabase.from('recipe_likes').select('recipe_id').eq('user_id', p.id).order('created_at', { ascending: false }).limit(48);
    const cards = await fetchCards((data ?? []).map((x: { recipe_id: string }) => x.recipe_id));
    body = cards.length ? <RecipeGrid items={cards} /> : <EmptyState title="No liked recipes" />;
  }

  const pinned = p.pinned_recipe_id ? (await fetchCards([p.pinned_recipe_id]))[0] : null;
  const site = p.website ? safeUrl(p.website) : null;

  return (
    <div className="container py-8">
      <header className="flex flex-wrap items-start gap-5">
        <ProfileAvatar profile={p} size={88} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="font-display text-3xl">{p.display_name || p.username}</h1>
          <p className="text-mute">@{p.username} · joined {formatDate(p.created_at)}{p.experience_level && <> · <span className="capitalize">{p.experience_level}</span></>}</p>
          {p.bio && <p className="max-w-2xl text-ink/85">{p.bio}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute">
            {location && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{location}</span>}
            {site && <a href={site} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-1 text-amber hover:underline"><Globe size={14} aria-hidden />{new URL(site).hostname}</a>}
            {social.map(([k, v]) => <span key={k} className="capitalize">{k}: <span className="text-ink/80">{v}</span></span>)}
          </div>
        </div>
        <div className="flex gap-2 no-print">{own ? <Link href="/settings" className="btn">Edit profile</Link> : <ReportDialog targetType="profile" targetId={p.id} signedIn={!!viewer} />}</div>
      </header>
      {pinned && <section className="mt-6" aria-label="Pinned recipe"><p className="mb-2 text-xs uppercase tracking-wider text-mute">Pinned recipe</p><div className="max-w-md"><RecipeGrid items={[pinned]} /></div></section>}
      <div className="mt-8"><Tabs label="Profile sections" tabs={tabs} current={current} hrefFor={(k) => `/u/${p.username}?tab=${k}`} /></div>
      <div className="mt-6">{body}</div>
    </div>
  );
}
