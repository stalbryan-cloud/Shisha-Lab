import type { Metadata } from 'next';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm, NotificationPrefsForm, PasswordForm, DeleteAccountForm } from '@/components/forms/SettingsForms';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

export default async function SettingsPage() {
  const v = await requireViewer('/settings');
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_private_settings');
  const priv = (data ?? {}) as { notification_prefs?: Record<string, boolean>; location?: string | null };
  const p = v.profile;
  return (
    <div className="container max-w-3xl space-y-10 py-8">
      <h1 className="font-display text-3xl">Settings</h1>
      <section aria-labelledby="s-prof" className="card p-6"><h2 id="s-prof" className="section-title mb-4">Profile</h2>
        <ProfileForm p={{ username: p.username, display_name: p.display_name, bio: p.bio, location: priv.location ?? null, website: p.website, experience_level: p.experience_level, show_saved: p.show_saved, show_likes: p.show_likes, show_location: p.show_location, avatar_path: p.avatar_path, social_links: p.social_links }} /></section>
      <section aria-labelledby="s-notif" className="card p-6"><h2 id="s-notif" className="section-title mb-4">Notifications</h2><NotificationPrefsForm prefs={priv.notification_prefs ?? {}} /></section>
      <section aria-labelledby="s-pw" className="card p-6"><h2 id="s-pw" className="section-title mb-1">Password</h2><p className="mb-4 text-sm text-mute">Signed in as {v.email}.</p><PasswordForm /></section>
      <section aria-labelledby="s-del" className="card border-danger/40 p-6"><h2 id="s-del" className="section-title mb-3 text-danger">Delete account</h2><DeleteAccountForm username={p.username} /></section>
    </div>
  );
}
