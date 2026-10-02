'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp, safeNext, str } from '@/lib/actions/helpers';
import { fail, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { loginSchema, signupSchema } from '@/lib/validators/community';

export async function signup(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ip = await clientIp();
  const limit = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return fail(`Too many sign-up attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`, 'rate_limited');

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail('Please fix the highlighted fields.', 'invalid', zodFieldErrors(parsed.error));
  const { email, password, username } = parsed.data;

  const supabase = await createClient();
  const { data: taken } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) return fail('That username is already taken.', 'duplicate', { username: ['That username is already taken.'] });

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username, age_ack: 'true' }, emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
  });
  if (error) {
    if (/registered|already/i.test(error.message)) return fail('An account with that email already exists. Try logging in.', 'duplicate', { email: ['Already registered'] });
    if (/password/i.test(error.message)) return fail('That password is not accepted. Choose a longer, less common one.', 'invalid', { password: ['Choose a stronger password'] });
    return fail('We could not create your account right now. Please try again.', 'unknown');
  }
  if (data.session) { revalidatePath('/', 'layout'); redirect('/me'); }
  return ok(undefined, 'Check your email for a confirmation link to finish creating your account.');
}

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail('Please fix the highlighted fields.', 'invalid', zodFieldErrors(parsed.error));
  const limit = rateLimit(`login:${ip}:${parsed.data.email.toLowerCase()}`, 8, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`, 'rate_limited');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) return fail('Please confirm your email address first — check your inbox.', 'forbidden');
    return fail('Email or password is incorrect.', 'unauthenticated');   // same message for unknown email and wrong password
  }
  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next'), '/'));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 3, 60 * 60 * 1000).ok) return fail('Too many requests. Try again later.', 'rate_limited');
  const email = str(formData, 'email').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.', 'invalid', { email: ['Enter a valid email address.'] });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/settings` });
  return ok(undefined, 'If an account exists for that address, a reset link is on its way.');   // never reveal whether the email exists
}

/** Used on /settings after following a reset-password email link (the session was established by /auth/callback). */
export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = str(formData, 'password');
  if (password.length < 10) return fail('Use at least 10 characters.', 'invalid', { password: ['Use at least 10 characters.'] });
  if (password !== str(formData, 'confirm')) return fail('The passwords do not match.', 'invalid', { confirm: ['Does not match'] });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Please sign in first.', 'unauthenticated');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail('That password was not accepted. Choose a longer, less common one.', 'invalid', { password: ['Not accepted'] });
  return ok(undefined, 'Password updated.');
}
