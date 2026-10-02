import 'server-only';
import { headers } from 'next/headers';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/actions/result';
import type { Viewer } from '@/lib/types';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
export type AuthedOk = { viewer: Viewer; supabase: SupabaseServer };
export type AuthedFail = { error: ActionResult<never> };
export type Authed = AuthedOk;

/**
 * Resolve the signed-in viewer + an RLS-scoped client, or an `unauthenticated` failure.
 * Declared as an explicit union (not inferred from object literals) so `'error' in a` narrows cleanly.
 */
export async function authed(): Promise<AuthedOk | AuthedFail> {
  const viewer = await getViewer();
  if (!viewer) return { error: fail('Please sign in to do that.', 'unauthenticated') };
  const supabase = await createClient();
  return { viewer, supabase };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
}

/** Only same-site relative paths are allowed as post-login redirects (prevents open redirects). */
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = '/'): string {
  const n = typeof next === 'string' ? next : '';
  return /^\/(?!\/|\\)[^\s]*$/.test(n) ? n : fallback;
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
