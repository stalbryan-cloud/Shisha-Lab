import type { Metadata } from 'next';
import { requireViewer } from '@/lib/auth';
import { getCategories } from '@/lib/queries/forum';
import { NewTopicForm } from '@/components/forum/NewTopicForm';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New topic', robots: { index: false } };

export default async function NewTopicPage({ searchParams }: { searchParams: Promise<{ category?: string; recipe?: string }> }) {
  await requireViewer('/community/new');
  const sp = await searchParams;
  const cats = await getCategories();
  const supabase = await createClient();
  const recipe = sp.recipe ? (await supabase.from('recipes').select('id, title').eq('slug', sp.recipe).maybeSingle()).data : null;
  return (
    <div className="container max-w-3xl py-8">
      <h1 className="font-display text-3xl">Start a topic</h1>
      <p className="mt-1 text-sm text-mute">Search first — your question may already be answered. Selling or trading tobacco is not allowed.</p>
      <NewTopicForm categories={cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))} defaultCategory={cats.find((c) => c.slug === sp.category)?.id} recipe={recipe ?? null} />
    </div>
  );
}
