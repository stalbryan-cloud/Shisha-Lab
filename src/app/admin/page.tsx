import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminHome() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('admin_dashboard');
  const d = (data ?? {}) as Record<string, number>;
  const cards: [string, number | undefined, string?][] = [
    ['Users', d.users], ['New users (7 d)', d.new_users_7d], ['Recipes', d.recipes], ['Published', d.published], ['Drafts', d.drafts], ['Forum topics', d.topics], ['Forum posts', d.posts],
    ['Comments', d.comments], ['Ratings', d.reviews], ['Open reports', d.open_reports, '/moderation'], ['Active suspensions', d.active_suspensions, '/admin/users'], ['Stored files', d.storage_objects],
  ];
  const mb = d.storage_bytes ? (d.storage_bytes / 1024 / 1024).toFixed(1) : '0';
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([l, v, href]) => {
        const inner = <><p className="font-display text-3xl text-amber">{(v ?? 0).toLocaleString('en-GB')}</p><p className="text-xs uppercase tracking-wider text-mute">{l}</p></>;
        return href ? <Link key={l} href={href} className="card p-4 hover:border-amber/40">{inner}</Link> : <div key={l} className="card p-4">{inner}</div>;
      })}</div>
      <p className="text-sm text-mute">Storage used: {mb} MB. All figures are aggregates.</p>
    </div>
  );
}
