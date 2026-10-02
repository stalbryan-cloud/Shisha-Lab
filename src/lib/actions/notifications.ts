'use server';
import { revalidatePath } from 'next/cache';
import { authed } from '@/lib/actions/helpers';
import { fromDbError, ok, type ActionResult } from '@/lib/actions/result';

export async function markRead(id: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', a.viewer.id).is('read_at', null);
  if (error) return fromDbError(error);
  revalidatePath('/', 'layout');
  return ok();
}

export async function markAllRead(): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', a.viewer.id).is('read_at', null);
  if (error) return fromDbError(error);
  revalidatePath('/', 'layout');
  return ok(undefined, 'All caught up.');
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const { error } = await a.supabase.from('notifications').delete().eq('id', id).eq('user_id', a.viewer.id);
  if (error) return fromDbError(error);
  revalidatePath('/notifications');
  return ok();
}
