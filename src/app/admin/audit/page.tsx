import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate, timeAgo } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audit log · Admin', robots: { index: false } };
const PAGE = 40;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(['moderator', 'admin']);
  const page = Math.max(1, parseInt((await searchParams).page ?? '1') || 1);
  const supabase = await createClient();
  const { data, count } = await supabase.from('moderation_actions')
    .select('id, action, target_type, target_id, reason, created_at, moderator:profiles!moderation_actions_moderator_id_fkey(username), target_user:profiles!moderation_actions_target_user_id_fkey(username)', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  type Row = { id: string; action: string; target_type: string; target_id: string | null; reason: string | null; created_at: string; moderator: { username: string } | null; target_user: { username: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Audit log</h1><p className="text-sm text-mute">Append-only record of every moderation and administration action.</p>
      <AdminDataTable caption="Moderation actions" rowKey={(r) => r.id} rows={rows} empty="No actions recorded yet." columns={[
        { key: 'w', header: 'When', render: (r) => <time dateTime={r.created_at} title={formatDate(r.created_at)} className="text-mute">{timeAgo(r.created_at)}</time> },
        { key: 'm', header: 'By', render: (r) => r.moderator ? `@${r.moderator.username}` : <span className="text-mute">[deleted]</span> },
        { key: 'a', header: 'Action', render: (r) => <span className="chip">{r.action}</span> },
        { key: 't', header: 'Target', render: (r) => <>{r.target_type}{r.target_user && <span className="text-mute"> · @{r.target_user.username}</span>}</> },
        { key: 'r', header: 'Reason', render: (r) => r.reason ?? <span className="text-mute">—</span> },
      ]} />
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(n) => `/admin/audit?page=${n}`} />
    </div>
  );
}
