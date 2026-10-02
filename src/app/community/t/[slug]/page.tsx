import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer, isStaff } from '@/lib/auth';
import { getTopicBySlug, getPosts, getTopicViewerState } from '@/lib/queries/forum';
import { getModeratorIds } from '@/lib/queries/recipe-detail';
import { createClient } from '@/lib/supabase/server';
import { renderMarkdown, stripMarkdown } from '@/lib/core/markdown';
import { UserBadge } from '@/components/ui/UserBadge';
import { ReportDialog } from '@/components/ui/ReportDialog';
import { TopicThread } from '@/components/forum/TopicThread';
import { TopicActions } from '@/components/forum/TopicActions';
import { TopicViewTracker } from '@/components/forum/TopicViewTracker';
import { timeAgo } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTopicBySlug((await params).slug);
  if (!t) return { title: 'Topic not found' };
  return { title: t.title, description: stripMarkdown(t.body).slice(0, 160), alternates: { canonical: `/community/t/${t.slug}` }, robots: t.status === 'removed' ? { index: false } : undefined };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) notFound();
  const viewer = await getViewer();
  const posts = await getPosts(topic.id);
  const [state, mods] = await Promise.all([
    getTopicViewerState(topic.id, viewer?.id ?? null, posts.map((p) => p.id)),
    getModeratorIds([...new Set([topic.author_id, ...posts.map((p) => p.author_id)].filter((x): x is string => !!x))]),
  ]);
  let recipe: { slug: string; title: string } | null = null;
  if (topic.recipe_id) {
    const supabase = await createClient();
    const { data } = await supabase.from('recipes').select('slug, title').eq('id', topic.recipe_id).maybeSingle();
    recipe = data;
  }
  const html: Record<string, string> = {};
  for (const p of posts) { html[p.id] = renderMarkdown(p.body); html[`q:${p.id}`] = renderMarkdown(p.body.slice(0, 400)); }
  const staff = isStaff(viewer?.role);
  const removed = topic.status === 'removed';
  return (
    <div className="container max-w-4xl py-8">
      <TopicViewTracker topicId={topic.id} />
      <nav aria-label="Breadcrumb" className="text-sm text-mute"><Link className="hover:text-ink" href="/community">Community</Link>{topic.category && <> / <Link className="hover:text-ink" href={`/community?category=${topic.category.slug}`}>{topic.category.name}</Link></>}</nav>
      <h1 className="mt-2 font-display text-3xl">{topic.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <UserBadge profile={removed ? null : topic.author} badges={topic.author_id && mods.has(topic.author_id) ? ['moderator'] : []} />
        <span className="text-mute">{timeAgo(topic.created_at)} · {topic.views} views</span>
        {topic.tags?.map((g) => <Link key={g.slug} href={`/community?tag=${g.slug}`} className="chip hover:border-amber/50">#{g.name}</Link>)}
      </div>
      {recipe && <p className="mt-2 text-sm text-mute">Related recipe: <Link className="text-amber underline" href={`/recipes/${recipe.slug}`}>{recipe.title}</Link></p>}
      <article className="card mt-5 p-5">
        {removed ? <p className="italic text-mute">This topic was removed by a moderator.</p> : <div className="prose-lab" dangerouslySetInnerHTML={{ __html: renderMarkdown(topic.body) }} />}
      </article>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <TopicActions topicId={topic.id} slug={topic.slug} signedIn={!!viewer} bookmarked={state.bookmarked} following={state.following} voted={state.votedTopic} upvotes={topic.upvotes}
          staff={staff} status={topic.status} pinned={topic.is_pinned} featured={topic.is_featured} />
        {topic.author_id !== viewer?.id && <ReportDialog targetType="forum_topic" targetId={topic.id} signedIn={!!viewer} />}
      </div>
      <div className="mt-8">
        <TopicThread topicId={topic.id} slug={topic.slug} locked={topic.status !== 'open'} posts={posts} html={html} viewerId={viewer?.id ?? null} staff={staff}
          moderatorIds={[...mods]} topicAuthorId={topic.author_id} votedPostIds={[...state.votedPosts]} />
      </div>
    </div>
  );
}
