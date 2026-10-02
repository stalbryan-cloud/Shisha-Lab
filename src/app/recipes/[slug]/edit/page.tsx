import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadRecipeForEdit } from '@/lib/actions/recipes';
import { getWizardCatalog } from '@/lib/queries/catalog';
import { getSiteSettings } from '@/lib/site';
import { RecipeWizard, type WizardInitial } from '@/components/wizard/RecipeWizard';

export const metadata: Metadata = { title: 'Edit recipe', robots: { index: false } };

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireViewer(`/recipes/${slug}/edit`);
  const supabase = await createClient();
  const { data: r } = await supabase.from('recipes').select('id').eq('slug', slug).maybeSingle();
  if (!r) notFound();
  const loaded = await loadRecipeForEdit(r.id);   // owner-only: returns not_found for everyone else (RLS + explicit creator check)
  if (!loaded.ok || !loaded.data) notFound();
  const [catalog, settings] = await Promise.all([getWizardCatalog(), getSiteSettings()]);
  return <RecipeWizard initial={loaded.data as unknown as WizardInitial} catalog={catalog} maxImageMb={settings.upload_max_image_mb} />;
}
