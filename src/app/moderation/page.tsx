import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ModerationQueue, type QueueItem } from '@/components/admin/ModerationQueue';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';

export const metadata: Metadata = { title: 'Moderation', robots: { index: false, follow: false } };
const PAGE = 25;

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const viewer = await requireRole(['moderator', 'admin']);
  const sp = await searchParams;
  const status = ['open', 'in_review', 'resolved', 'dismissed', 'all'].includes(sp.status ?? '') ? sp.status! : 'open';
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_queue', { p_status: status, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const rows = (data ?? []) as (QueueItem & { total: number })[];
  const total = Number(rows[0]?.total ?? 0);
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="font-display text-3xl">Moderation queue</h1><div className="flex gap-3 text-sm">{viewer.role === 'admin' && <Link className="text-amber hover:underline" href="/admin">Admin</Link>}<Link className="text-amber hover:underline" href="/admin/audit">Audit log</Link></div></div>
      <p className="mt-1 text-sm text-mute">Every action needs a reason and is written to the audit log with your name.</p>
      <div className="mt-4"><Tabs label="Report status" current={status} tabs={[['open', 'Open'], ['in_review', 'In review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['all', 'All']].map(([key, label]) => ({ key, label }))} hrefFor={(k) => `/moderation?status=${k}`} /></div>
      <div className="mt-6">
        {error ? <p role="alert" className="text-danger">Could not load the queue.</p> : rows.length === 0 ? <EmptyState title="Queue is clear" body="No reports with this status." /> : <ModerationQueue items={rows} viewerId={viewer.id} />}
      </div>
      <Pagination page={page} pageSize={PAGE} total={total} hrefFor={(n) => `/moderation?status=${status}&page=${n}`} />
    </div>
  );
}
