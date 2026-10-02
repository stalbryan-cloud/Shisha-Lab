import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NotificationList } from '@/components/layout/NotificationList';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NotificationRow } from '@/lib/types';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };

export default async function NotificationsPage() {
  const v = await requireViewer('/notifications');
  const supabase = await createClient();
  const { data } = await supabase.from('notifications')
    .select('id, type, message, read_at, created_at, recipe_id, topic_id, comment_id, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_path), recipe:recipes(slug, title), topic:forum_topics(slug, title)')
    .eq('user_id', v.id).order('created_at', { ascending: false }).limit(100);
  const items = (data ?? []) as unknown as NotificationRow[];
  return (
    <div className="container max-w-3xl py-8">
      <div className="flex items-end justify-between"><h1 className="font-display text-3xl">Notifications</h1><Link href="/settings" className="text-sm text-amber hover:underline">Preferences</Link></div>
      <div className="mt-6">{items.length ? <NotificationList items={items} /> : <EmptyState icon={<Bell size={32} />} title="You’re all caught up" body="Replies, mentions and activity on your recipes will show up here." />}</div>
    </div>
  );
}
