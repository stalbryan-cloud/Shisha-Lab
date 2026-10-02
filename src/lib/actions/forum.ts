'use server';
import { revalidatePath } from 'next/cache';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { postSchema, topicSchema } from '@/lib/validators/community';
import { extractMentions } from '@/lib/core/markdown';
import { randomSuffix, slugify } from '@/lib/utils';

export async function createTopic(input: Record<string, unknown>): Promise<ActionResult<{ slug: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return fail('Please fix the highlighted fields.', 'invalid', zodFieldErrors(parsed.error));
  const d = parsed.data;
  const slug = `${slugify(d.title, 50)}-${randomSuffix(6)}`;
  const { data, error } = await a.supabase.from('forum_topics')
    .insert({ slug, category_id: d.category_id, author_id: a.viewer.id, title: d.title, body: d.body, recipe_id: d.recipe_id ?? null })
    .select('id').single();
  if (error) return fromDbError(error);

  if (d.tags.length) {
    await a.supabase.from('tags').upsert(d.tags.map((t) => ({ slug: t, name: t.replace(/-/g, ' ') })), { onConflict: 'slug', ignoreDuplicates: true });
    const { data: tagRows } = await a.supabase.from('tags').select('id').in('slug', d.tags);
    if (tagRows?.length) await a.supabase.from('forum_topic_tags').insert(tagRows.map((t: { id: string }) => ({ topic_id: data.id, tag_id: t.id })));
  }
  await a.supabase.from('forum_follows').insert({ user_id: a.viewer.id, topic_id: data.id });   // authors follow their own topics
  const mentions = extractMentions(d.body);
  if (mentions.length) await a.supabase.rpc('notify_mentions', { p_usernames: mentions, p_recipe: null, p_topic: data.id, p_comment: null });
  revalidatePath('/community');
  return ok({ slug });
}

export async function replyToTopic(input: Record<string, unknown> & { slug?: string }): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return fail('Please check your reply.', 'invalid', zodFieldErrors(parsed.error));
  const d = parsed.data;
  const { data, error } = await a.supabase.from('forum_posts')
    .insert({ topic_id: d.topic_id, author_id: a.viewer.id, body: d.body, quoted_post_id: d.quoted_post_id ?? null }).select('id').single();
  if (error) {
    // RLS refuses replies to locked/archived topics; give a clearer message than "permission denied"
    const { data: t } = await a.supabase.from('forum_topics').select('status').eq('id', d.topic_id).maybeSingle();
    if (t && t.status !== 'open') return fail('This topic is locked, so new replies are not allowed.', 'forbidden');
    return fromDbError(error);
  }
  const mentions = extractMentions(d.body);
  if (mentions.length) await a.supabase.rpc('notify_mentions', { p_usernames: mentions, p_recipe: null, p_topic: d.topic_id, p_comment: null });
  if (input.slug) revalidatePath(`/community/t/${input.slug}`);
  revalidatePath('/community');
  return ok({ id: data.id as string });
}

export async function editTopic(topicId: string, patch: { title: string; body: string }, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = topicSchema.pick({ title: true, body: true }).safeParse(patch);
  if (!parsed.success) return fail('Please check the title and text.', 'invalid', zodFieldErrors(parsed.error));
  const { data, error } = await a.supabase.from('forum_topics').update(parsed.data).eq('id', topicId).eq('author_id', a.viewer.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('You can only edit your own open topics.', 'forbidden');
  revalidatePath(`/community/t/${slug}`);
  return ok();
}

export async function editPost(postId: string, body: string, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const text = body.trim();
  if (!text || text.length > 20000) return fail('Replies must be 1–20000 characters.', 'invalid');
  const { data, error } = await a.supabase.from('forum_posts').update({ body: text }).eq('id', postId).eq('author_id', a.viewer.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('You can only edit your own replies in open topics.', 'forbidden');
  revalidatePath(`/community/t/${slug}`);
  return ok();
}

/** Deletion is allowed only inside the configurable window (site_settings.forum_delete_window_minutes) — enforced by RLS. */
export async function deletePost(postId: string, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('forum_posts').delete().eq('id', postId).eq('author_id', a.viewer.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('This reply can no longer be deleted. Use Report if it needs moderator attention.', 'forbidden');
  revalidatePath(`/community/t/${slug}`);
  return ok(undefined, 'Reply deleted.');
}

export async function deleteTopic(topicId: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('forum_topics').delete().eq('id', topicId).eq('author_id', a.viewer.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('Topics can only be deleted shortly after posting and while they have no replies.', 'forbidden');
  revalidatePath('/community');
  return ok(undefined, 'Topic deleted.');
}

async function flag(table: 'forum_bookmarks' | 'forum_follows', topicId: string, on: boolean, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { error } = on
    ? await a.supabase.from(table).insert({ user_id: a.viewer.id, topic_id: topicId })
    : await a.supabase.from(table).delete().eq('user_id', a.viewer.id).eq('topic_id', topicId);
  if (error && error.code !== '23505') return fromDbError(error);
  revalidatePath(`/community/t/${slug}`);
  return ok();
}
export const setBookmark = (topicId: string, on: boolean, slug: string) => flag('forum_bookmarks', topicId, on, slug);
export const setFollow = (topicId: string, on: boolean, slug: string) => flag('forum_follows', topicId, on, slug);

export async function voteForum(target: { topic_id?: string; post_id?: string }, on: boolean, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  if (!target.topic_id === !target.post_id) return fail('Invalid vote.', 'invalid');
  const row = { user_id: a.viewer.id, topic_id: target.topic_id ?? null, post_id: target.post_id ?? null };
  const { error } = on
    ? await a.supabase.from('forum_votes').insert(row)
    : await (target.topic_id
        ? a.supabase.from('forum_votes').delete().eq('user_id', a.viewer.id).eq('topic_id', target.topic_id)
        : a.supabase.from('forum_votes').delete().eq('user_id', a.viewer.id).eq('post_id', target.post_id!));
  if (error && error.code !== '23505') return fromDbError(error);
  revalidatePath(`/community/t/${slug}`);
  return ok();
}

/** One view per visitor per 30 minutes (cookie set from a Server Action; Server Components can't set cookies). */
export async function recordTopicView(topicId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(topicId)) return;
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const key = `t_${topicId.slice(0, 8)}`;
  if (jar.get(key)) return;
  jar.set(key, '1', { maxAge: 1800, httpOnly: true, sameSite: 'lax', path: '/' });
  const { createClient } = await import('@/lib/supabase/server');
  await (await createClient()).rpc('record_topic_view', { p_topic: topicId });
}
