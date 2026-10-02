import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { UserRowActions } from '@/components/admin/UserRowActions';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Users · Admin', robots: { index: false } };
const PAGE = 25;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const viewer = await requireRole(['moderator', 'admin']);
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().replace(/[%,()]/g, '').slice(0, 40);
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1);
  const supabase = await createClient();
  let query = supabase.from('profiles').select('id, username, display_name, created_at, is_anonymized', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  const { data, count } = await query;
  const users = (data ?? []) as { id: string; username: string; display_name: string | null; created_at: string; is_anonymized: boolean }[];
  const ids = users.map((u) => u.id);
  const [{ data: roles }, { data: susp }] = await Promise.all([
    supabase.from('user_roles').select('user_id, role').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('user_suspensions').select('user_id, is_permanent, ends_at, lifted_at').is('lifted_at', null).in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
  ]);
  const roleOf = new Map<string, string>((roles ?? []).map((r: { user_id: string; role: string }): [string, string] => [r.user_id, r.role]));
  const suspended = new Set((susp ?? []).filter((s: { is_permanent: boolean; ends_at: string | null }) => s.is_permanent || (s.ends_at && new Date(s.ends_at) > new Date())).map((s: { user_id: string }) => s.user_id));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Users</h1>
      <form className="flex max-w-md gap-2" role="search"><label className="sr-only" htmlFor="uq">Search users</label><input id="uq" name="q" defaultValue={q} className="field" placeholder="Username or display name" /><button className="btn">Search</button></form>
      <AdminDataTable caption="Users" rowKey={(u) => u.id} rows={users} empty="No users found." columns={[
        { key: 'u', header: 'User', render: (u) => u.is_anonymized ? <span className="text-mute">[deleted user]</span> : <Link className="hover:text-amber" href={`/u/${u.username}`}>@{u.username}<span className="block text-xs text-mute">{u.display_name}</span></Link> },
        { key: 'r', header: 'Role', render: (u) => <span className="chip">{roleOf.get(u.id) ?? 'user'}</span> },
        { key: 's', header: 'Status', render: (u) => suspended.has(u.id) ? <span className="chip border-danger/50 text-danger">suspended</span> : <span className="text-mute">active</span> },
        { key: 'j', header: 'Joined', render: (u) => <span className="text-mute">{formatDate(u.created_at)}</span> },
        { key: 'a', header: 'Actions', render: (u) => u.is_anonymized ? null : <UserRowActions userId={u.id} username={u.username} role={roleOf.get(u.id) ?? 'user'} suspended={suspended.has(u.id)} isAdmin={viewer.role === 'admin'} isSelf={u.id === viewer.id} /> },
      ]} />
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(n) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
    </div>
  );
}
