import type { Metadata } from 'next';
import { requireViewer } from '@/lib/auth';
import { getWizardCatalog } from '@/lib/queries/catalog';
import { getSiteSettings } from '@/lib/site';
import { RecipeWizard } from '@/components/wizard/RecipeWizard';

export const metadata: Metadata = { title: 'Create a recipe', robots: { index: false } };

export default async function CreatePage() {
  await requireViewer('/create');
  const [catalog, settings] = await Promise.all([getWizardCatalog(), getSiteSettings()]);
  return <RecipeWizard initial={{ title: '', units: 'g', visibility: 'public' }} catalog={catalog} maxImageMb={settings.upload_max_image_mb} />;
}
