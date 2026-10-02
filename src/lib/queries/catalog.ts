import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Catalog } from '@/components/wizard/RecipeWizard';

/** Reference data for the wizard's pickers (informational ingredient database; no prices, no sellers). */
export async function getWizardCatalog(): Promise<Catalog> {
  const supabase = await createClient();
  const [aromas, tobaccos, flavours, profiles, tags] = await Promise.all([
    supabase.from('aromas').select('id, product_name, recommended_max_pct, aroma_brands(name), aroma_flavours(flavour_id)').order('product_name').limit(500),
    supabase.from('tobaccos').select('id, product_name, variety, origin, cut, tobacco_brands(name), tobacco_leaf_types(name, family)').order('product_name').limit(500),
    supabase.from('flavours').select('id, name').is('merged_into', null).order('name').limit(500),
    supabase.from('flavour_profiles').select('slug, name').order('name'),
    supabase.from('tags').select('slug').order('slug').limit(200),
  ]);
  type A = { id: string; product_name: string; recommended_max_pct: number | null; aroma_brands: { name: string } | null; aroma_flavours: { flavour_id: string }[] };
  type T = { id: string; product_name: string; variety: string | null; origin: string | null; cut: string | null; tobacco_brands: { name: string } | null; tobacco_leaf_types: { name: string; family: string | null } | null };
  return {
    aromas: ((aromas.data ?? []) as unknown as A[]).map((a) => ({ id: a.id, name: a.product_name, brand: a.aroma_brands?.name ?? null, flavour_id: a.aroma_flavours?.[0]?.flavour_id ?? null, rec_max: a.recommended_max_pct })),
    tobaccos: ((tobaccos.data ?? []) as unknown as T[]).map((t) => ({
      id: t.id, product_name: t.product_name, brand: t.tobacco_brands?.name ?? null, label: `${t.tobacco_brands?.name ? `${t.tobacco_brands.name} — ` : ''}${t.product_name}`,
      family: t.tobacco_leaf_types?.family ?? null, leaf_type: t.tobacco_leaf_types?.name ?? null, variety: t.variety, origin: t.origin, cut: t.cut,
    })),
    flavours: (flavours.data ?? []) as { id: string; name: string }[],
    profiles: (profiles.data ?? []) as { slug: string; name: string }[],
    tags: ((tags.data ?? []) as { slug: string }[]).map((t) => t.slug),
  };
}
