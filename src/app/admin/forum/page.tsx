import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCategories } from '@/lib/queries/forum';
import { CategoryManager, type CatVM } from '@/components/admin/CategoryManager';

export const metadata: Metadata = { title: 'Forum · Admin', robots: { index: false } };

export default async function AdminForum() {
  const viewer = await requireRole(['moderator', 'admin']);
  const cats = await getCategories(true);
  const supabase = await createClient();
  const { data } = await supabase.from('forum_category_moderators').select('category_id, profiles(username)');
  const mods = new Map<string, string[]>();
  for (const r of (data ?? []) as unknown as { category_id: string; profiles: { username: string } | null }[]) if (r.profiles) mods.set(r.category_id, [...(mods.get(r.category_id) ?? []), r.profiles.username]);
  const vm: CatVM[] = cats.map((c) => ({ id: c.id, name: c.name, description: c.description, is_archived: c.is_archived, moderators: mods.get(c.id) ?? [] }));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Forum categories</h1>
      {viewer.role === 'admin' ? <CategoryManager categories={vm} /> : <p className="text-mute">Only administrators can edit categories. Moderate topics from the community pages.</p>}
    </div>
  );
}
