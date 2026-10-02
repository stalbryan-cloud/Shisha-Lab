'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { commentSchema } from '@/lib/validators/community';
import { extractMentions } from '@/lib/core/markdown';

export async function postComment(input: { recipe_id: string; parent_id?: string | null; body: string; slug: string }): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check your comment.', 'invalid', zodFieldErrors(parsed.error));
  const { data, error } = await a.supabase.from('comments')
    .insert({ recipe_id: parsed.data.recipe_id, parent_id: parsed.data.parent_id ?? null, user_id: a.viewer.id, body: parsed.data.body })
    .select('id').single();
  if (error) return fromDbError(error);
  const mentions = extractMentions(parsed.data.body);
  if (mentions.length) await a.supabase.rpc('notify_mentions', { p_usernames: mentions, p_recipe: parsed.data.recipe_id, p_topic: null, p_comment: data.id });
  revalidatePath(`/recipes/${input.slug}`);
  return ok({ id: data.id as string });
}

export async function editComment(commentId: string, body: string, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const text = body.trim();
  if (text.length < 1 || text.length > 5000) return fail('Comments must be 1–5000 characters.', 'invalid');
  const { data, error } = await a.supabase.from('comments').update({ body: text }).eq('id', commentId).eq('user_id', a.viewer.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('You can only edit your own comments.', 'forbidden');
  revalidatePath(`/recipes/${slug}`);
  return ok();
}

/** Soft delete: the thread stays readable ("[deleted]") so replies keep their context. */
export async function deleteComment(commentId: string, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.from('comments').update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId).eq('user_id', a.viewer.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('You can only delete your own comments.', 'forbidden');
  revalidatePath(`/recipes/${slug}`);
  return ok(undefined, 'Comment deleted.');
}

export async function voteComment(commentId: string, on: boolean, slug: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  if (!z.string().uuid().safeParse(commentId).success) return fail('Invalid comment.', 'invalid');
  const { error } = on
    ? await a.supabase.from('comment_votes').insert({ comment_id: commentId, user_id: a.viewer.id })
    : await a.supabase.from('comment_votes').delete().eq('comment_id', commentId).eq('user_id', a.viewer.id);
  if (error && error.code !== '23505') return fromDbError(error);
  revalidatePath(`/recipes/${slug}`);
  return ok();
}

export async function continueInCommunity(commentId: string): Promise<ActionResult<{ topicSlug: string }>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { data, error } = await a.supabase.rpc('continue_in_community', { p_comment: commentId });
  if (error) return fromDbError(error);
  return ok({ topicSlug: data as string });
}
