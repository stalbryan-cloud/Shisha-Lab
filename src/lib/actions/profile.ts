'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { NOTIFICATION_TYPES, profileSchema } from '@/lib/validators/community';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const raw = Object.fromEntries(formData);
  const parsed = profileSchema.safeParse({
    ...raw, show_saved: raw.show_saved === 'on', show_likes: raw.show_likes === 'on', show_location: raw.show_location === 'on',
  });
  if (!parsed.success) return fail('Please fix the highlighted fields.', 'invalid', zodFieldErrors(parsed.error));
  const d = parsed.data;
  if (d.username !== a.viewer.profile.username) {
    const { data: taken } = await a.supabase.from('profiles').select('id').eq('username', d.username).maybeSingle();
    if (taken) return fail('That username is already taken.', 'duplicate', { username: ['That username is already taken.'] });
  }
  const social = { ...a.viewer.profile.social_links };
  for (const k of ['instagram', 'youtube', 'discord', 'reddit']) {
    const v = String(raw[`social_${k}`] ?? '').trim();
    if (v) social[k] = v.slice(0, 100); else delete social[k];
  }
  const { error } = await a.supabase.from('profiles').update({ ...d, social_links: social }).eq('id', a.viewer.id);
  if (error) return fromDbError(error);
  revalidatePath('/settings'); revalidatePath(`/u/${d.username}`);
  return ok(undefined, 'Profile saved.');
}

export async function setAvatar(path: string | null): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  if (path !== null && !path.startsWith(`${a.viewer.id}/`)) return fail('Invalid file.', 'invalid');
  const { error } = await a.supabase.from('profiles').update({ avatar_path: path }).eq('id', a.viewer.id);
  if (error) return fromDbError(error);
  revalidatePath('/', 'layout');
  return ok(undefined, 'Avatar updated.');
}

export async function updateNotificationPrefs(prefs: Record<string, boolean>): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const allowed = new Set<string>(NOTIFICATION_TYPES.map((t) => t[0]));
  const clean = Object.fromEntries(Object.entries(prefs).filter(([k, v]) => allowed.has(k) && typeof v === 'boolean'));
  const { error } = await a.supabase.from('profiles').update({ notification_prefs: clean }).eq('id', a.viewer.id);
  if (error) return fromDbError(error);
  revalidatePath('/settings');
  return ok(undefined, 'Notification preferences saved.');
}

export async function setAgeAcknowledged(): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  await a.supabase.from('profiles').update({ age_acknowledged_at: new Date().toISOString() }).eq('id', a.viewer.id);
  return ok();
}

/**
 * Account deletion. Step 1 (user's own JWT): anonymise the profile via delete_my_account().
 * Step 2 (service role, the ONLY use besides cron): remove the auth user; foreign keys set authorship to NULL,
 * so recipes, comments and topics remain as community history attributed to "[deleted user]".
 */
export async function deleteAccount(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  if (String(formData.get('confirm') ?? '').trim() !== a.viewer.profile.username) return fail('Type your username to confirm.', 'invalid', { confirm: ['Does not match'] });
  const { error } = await a.supabase.rpc('delete_my_account');
  if (error) return fromDbError(error, error.message.includes('last admin') ? error.message : undefined);
  const admin = createAdminClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(a.viewer.id);
  if (delErr) return fail('Your profile was anonymised, but the login could not be removed. Contact support.', 'unknown');
  await a.supabase.auth.signOut();
  redirect('/?account=deleted');
}
