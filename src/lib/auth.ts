import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Role, Viewer } from '@/lib/types';

const PROFILE_COLS =
  'id, username, display_name, avatar_path, bio, website, social_links, experience_level, pinned_recipe_id, show_saved, show_likes, show_location, is_anonymized, created_at';

/**
 * The signed-in user (verified with Supabase Auth, not just read from the cookie) with their profile and role.
 * Role is read from the user_roles table through RLS — it is never taken from the client.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLS).eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ]);
  if (!profile) return null;
  return { id: user.id, email: user.email, profile: profile as Profile, role: ((roleRow?.role as Role) ?? 'user') };
});

export async function requireViewer(next?: string): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return v;
}

export const isStaff = (role: Role | undefined) => role === 'moderator' || role === 'admin';

/** Server-side gate for /admin and /moderation. Renders the 404 page for everyone else so the route is not advertised. */
export async function requireRole(roles: Role[]): Promise<Viewer> {
  const v = await requireViewer();
  if (!roles.includes(v.role)) {
    const { notFound } = await import('next/navigation');
    notFound();
  }
  return v;
}
