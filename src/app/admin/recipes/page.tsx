import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { RecipeAdminActions } from '@/components/admin/RecipeAdminActions';
import { Pagination } from '@/components/ui/Pagination';
import { formatVersion, timeAgo } from '@/lib/utils';

export const metadata: Metadata = { title: 'Recipes · Admin', robots: { index: false } };
const PAGE = 25;

export default async function AdminRecipes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireRole(['moderator', 'admin']);
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().replace(/[%,()]/g, '').slice(0, 60);
  const status = ['draft', 'published', 'archived'].includes(sp.status ?? '') ? sp.status! : '';
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1);
  const supabase = await createClient();
  let query = supabase.from('recipes').select('id, slug, title, status, visibility, moderation, is_featured, version_major, version_minor, updated_at, creator:profiles!recipes_creator_id_fkey(username)', { count: 'exact' })
    .order('updated_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike('title', `%${q}%`);
  if (status) query = query.eq('status', status);
  const { data, count } = await query;
  type Row = { id: string; slug: string; title: string; status: string; visibility: string; moderation: string; is_featured: boolean; version_major: number; version_minor: number; updated_at: string; creator: { username: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Recipes</h1>
      <form className="flex flex-wrap gap-2" role="search"><label className="sr-only" htmlFor="rq">Search recipes</label><input id="rq" name="q" defaultValue={q} className="field max-w-xs" placeholder="Title contains…" />
        <label className="sr-only" htmlFor="rs">Status</label><select id="rs" name="status" defaultValue={status} className="field w-40"><option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select><button className="btn">Filter</button></form>
      <AdminDataTable caption="Recipes" rowKey={(r) => r.id} rows={rows} columns={[
        { key: 't', header: 'Recipe', render: (r) => <><Link className="hover:text-amber" href={`/recipes/${r.slug}`}>{r.title}</Link><span className="block text-xs text-mute">by {r.creator ? `@${r.creator.username}` : '[deleted]'} · {formatVersion(r.version_major, r.version_minor)}</span></> },
        { key: 's', header: 'State', render: (r) => <span className="text-xs"><span className="chip capitalize">{r.status}</span> <span className="chip">{r.visibility}</span> {r.moderation !== 'visible' && <span className="chip border-danger/50 text-danger">{r.moderation}</span>} {r.is_featured && <span className="chip chip-amber">featured</span>}</span> },
        { key: 'u', header: 'Updated', render: (r) => <span className="text-mute">{timeAgo(r.updated_at)}</span> },
        { key: 'a', header: 'Actions', render: (r) => <RecipeAdminActions id={r.id} featured={r.is_featured} moderation={r.moderation} /> },
      ]} />
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(n) => `/admin/recipes?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(n) })}`} />
    </div>
  );
}
