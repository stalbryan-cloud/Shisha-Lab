'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, type ActionResult } from '@/lib/actions/result';
import { isStaff } from '@/lib/auth';

/** Every action here is a thin wrapper over a SECURITY DEFINER function that re-checks the caller's role in the database. */
async function staff() {
  const a = await authed();
  if ('error' in a) return a;
  if (!isStaff(a.viewer.role)) return { error: fail('You do not have access to moderation tools.', 'forbidden') } as const;
  return a;
}

const reason = z.string().trim().min(3, 'A short reason is required (it is stored in the audit log)').max(500);
const id = z.string().uuid();

export async function setContentState(input: { type: 'recipe' | 'comment' | 'review' | 'experiment' | 'forum_topic' | 'forum_post'; id: string; state: 'visible' | 'hidden' | 'removed'; reason: string; reportId?: string | null }): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const r = reason.safeParse(input.reason);
  if (!r.success || !id.safeParse(input.id).success) return fail(r.success ? 'Invalid target.' : r.error.issues[0].message, 'invalid');
  const { error } = await a.supabase.rpc('mod_set_state', { p_type: input.type, p_id: input.id, p_state: input.state, p_reason: r.data, p_report: input.reportId ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/moderation'); revalidatePath('/admin', 'layout'); revalidatePath('/', 'layout');
  return ok(undefined, `Content ${input.state === 'visible' ? 'restored' : input.state}.`);
}

export async function resolveReport(input: { reportId: string; status: 'in_review' | 'resolved' | 'dismissed'; resolution?: string; notes?: string; priority?: 1 | 2 | 3; assignToMe?: boolean }): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.rpc('mod_resolve_report', {
    p_report: input.reportId, p_status: input.status, p_resolution: input.resolution?.slice(0, 500) ?? null,
    p_notes: input.notes?.slice(0, 2000) ?? null, p_assign: input.assignToMe ? a.viewer.id : null, p_priority: input.priority ?? null,
  });
  if (error) return fromDbError(error);
  revalidatePath('/moderation');
  return ok(undefined, input.status === 'dismissed' ? 'Report dismissed.' : 'Report updated.');
}

export async function warnUser(userId: string, why: string, reportId?: string | null): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const r = reason.safeParse(why);
  if (!r.success) return fail(r.error.issues[0].message, 'invalid');
  const { error } = await a.supabase.rpc('mod_warn_user', { p_user: userId, p_reason: r.data, p_report: reportId ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/moderation'); revalidatePath('/admin/users');
  return ok(undefined, 'Warning sent.');
}

export async function suspendUser(input: { userId: string; reason: string; days?: number; permanent?: boolean; reportId?: string | null }): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const r = reason.safeParse(input.reason);
  if (!r.success) return fail(r.error.issues[0].message, 'invalid');
  const { error } = await a.supabase.rpc('mod_suspend_user', {
    p_user: input.userId, p_reason: r.data, p_days: input.permanent ? null : input.days ?? null,
    p_permanent: !!input.permanent, p_report: input.reportId ?? null,
  });
  if (error) return fromDbError(error);
  revalidatePath('/moderation'); revalidatePath('/admin/users');
  return ok(undefined, input.permanent ? 'User banned.' : 'User suspended.');
}

export async function liftSuspension(userId: string, why?: string): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.rpc('mod_lift_suspension', { p_user: userId, p_reason: why?.slice(0, 500) ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/moderation'); revalidatePath('/admin/users');
  return ok(undefined, 'Restrictions lifted.');
}

export async function setTopicFlags(topicId: string, flags: { status?: 'open' | 'locked' | 'archived' | 'removed'; pinned?: boolean; featured?: boolean }, why?: string): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.rpc('mod_set_topic_flags', {
    p_topic: topicId, p_status: flags.status ?? null, p_pinned: flags.pinned ?? null, p_featured: flags.featured ?? null, p_reason: why ?? null,
  });
  if (error) return fromDbError(error);
  revalidatePath('/community'); revalidatePath('/moderation');
  return ok();
}

export async function featureRecipe(recipeId: string, featured: boolean, why?: string): Promise<ActionResult> {
  const a = await staff();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.rpc('mod_feature_recipe', { p_recipe: recipeId, p_featured: featured, p_reason: why ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/'); revalidatePath('/admin/recipes');
  return ok(undefined, featured ? 'Recipe featured.' : 'Recipe unfeatured.');
}

/** Lock/unlock comments on a recipe is modelled as hiding the recipe's discussion via recipe moderation tooling in /admin. */
