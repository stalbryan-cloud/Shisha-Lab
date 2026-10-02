import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export async function NotificationBell({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  const n = count ?? 0;
  return (
    <Link href="/notifications" className="btn btn-ghost relative px-2.5" aria-label={n ? `Notifications, ${n} unread` : 'Notifications'}>
      <Bell size={18} aria-hidden />
      {n > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-semibold text-white">{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}
