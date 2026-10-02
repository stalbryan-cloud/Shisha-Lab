import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Paged, PostRow, TopicRow } from '@/lib/types';

export const TOPIC_PAGE_SIZE = 20;
export const TOPIC_SORTS = ['latest', 'popular', 'views', 'replies', 'unanswered'] as const;
export const TOPIC_RANGES = ['day', 'week', 'month', 'year', 'all'] as const;
export const TOPIC_SORT_LABELS: Record<(typeof TOPIC_SORTS)[number], string> = { latest: 'Latest activity', popular: 'Most popular', views: 'Most viewed', replies: 'Most replies', unanswered: 'Unanswered' };

const TOPIC_SELECT = `id, slug, category_id, author_id, title, body, status, is_pinned, is_featured, views, reply_count, upvotes, recipe_id,
  created_at, updated_at, last_activity_at,
  author:profiles!forum_topics_author_id_fkey(username, display_name, avatar_path),
  category:forum_categories!forum_topics_category_id_fkey(slug, name),
  tags:forum_topic_tags(tags(slug, name))`;

type RawTopic = Omit<TopicRow, 'tags'> & { tags: { tags: { slug: string; name: string } | null }[] };
const norm = (t: RawTopic): TopicRow => ({ ...t, tags: (t.tags ?? []).map((x) => x.tags).filter((x): x is { slug: string; name: string } => !!x) });

export async function getCategories(includeArchived = false) {
  const supabase = await createClient();
  let q = supabase.from('forum_categories').select('id, slug, name, description, sort_order, is_archived').order('sort_order');
  if (!includeArchived) q = q.eq('is_archived', false);
  const { data } = await q;
  return (data ?? []) as { id: string; slug: string; name: string; description: string | null; sort_order: number; is_archived: boolean }[];
}

export interface TopicFilters { category?: string | null; sort?: string; range?: string; q?: string; tag?: string; page?: number; author?: string | null }

export async function listTopics(f: TopicFilters): Promise<Paged<TopicRow>> {
  const supabase = await createClient();
  const page = Math.max(1, f.page ?? 1);
  const { data, error } = await supabase.rpc('list_topics', {
    p_category: f.category ?? null, p_sort: (TOPIC_SORTS as readonly string[]).includes(f.sort ?? '') ? f.sort : 'latest',
    p_range: (TOPIC_RANGES as readonly string[]).includes(f.range ?? '') ? f.range : 'all', p_q: f.q || null, p_tag: f.tag || null,
    p_author: f.author ?? null, p_limit: TOPIC_PAGE_SIZE, p_offset: (page - 1) * TOPIC_PAGE_SIZE,
  });
  if (error) throw new Error('Could not load topics');
  const rows = (data ?? []) as { id: string; total: number }[];
  if (!rows.length) return { items: [], total: 0, page, pageSize: TOPIC_PAGE_SIZE };
  const { data: topics } = await supabase.from('forum_topics').select(TOPIC_SELECT).in('id', rows.map((r) => r.id));
  const byId = new Map(((topics ?? []) as unknown as RawTopic[]).map((t) => [t.id, norm(t)]));
  return { items: rows.map((r) => byId.get(r.id)).filter((t): t is TopicRow => !!t), total: Number(rows[0].total), page, pageSize: TOPIC_PAGE_SIZE };
}

export async function getTopicBySlug(slug: string): Promise<TopicRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('forum_topics').select(TOPIC_SELECT).eq('slug', slug).maybeSingle();
  return data ? norm(data as unknown as RawTopic) : null;
}

export async function getPosts(topicId: string): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('forum_posts')
    .select('id, topic_id, author_id, quoted_post_id, body, upvotes, moderation, created_at, edited_at, author:profiles!forum_posts_author_id_fkey(username, display_name, avatar_path)')
    .eq('topic_id', topicId).order('created_at').limit(500);
  return (data ?? []) as unknown as PostRow[];
}

export async function getTopicViewerState(topicId: string, userId: string | null, postIds: string[]) {
  if (!userId) return { bookmarked: false, following: false, votedTopic: false, votedPosts: new Set<string>() };
  const supabase = await createClient();
  const [b, f, v] = await Promise.all([
    supabase.from('forum_bookmarks').select('topic_id').eq('topic_id', topicId).eq('user_id', userId).maybeSingle(),
    supabase.from('forum_follows').select('topic_id').eq('topic_id', topicId).eq('user_id', userId).maybeSingle(),
    supabase.from('forum_votes').select('topic_id, post_id').eq('user_id', userId).or(`topic_id.eq.${topicId}${postIds.length ? `,post_id.in.(${postIds.join(',')})` : ''}`),
  ]);
  const votes = (v.data ?? []) as { topic_id: string | null; post_id: string | null }[];
  return { bookmarked: !!b.data, following: !!f.data, votedTopic: votes.some((x) => x.topic_id === topicId), votedPosts: new Set(votes.map((x) => x.post_id).filter((x): x is string => !!x)) };
}

export async function activeDiscussions(limit = 5): Promise<TopicRow[]> {
  return (await listTopics({ sort: 'latest', range: 'week' })).items.slice(0, limit);
}
