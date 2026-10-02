import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { exploreFacets } from '@/lib/queries/recipes';
import type { FilterOptions } from '@/components/recipe/RecipeFilters';

export const getFilterOptions = cache(async (): Promise<FilterOptions> => {
  const supabase = await createClient();
  const [facets, brands, aromas] = await Promise.all([
    exploreFacets(),
    supabase.from('tobacco_brands').select('slug, name').order('name').limit(100),
    supabase.from('aromas').select('slug, product_name').order('product_name').limit(300),
  ]);
  return {
    flavours: facets.flavours, profiles: facets.profiles, leafTypes: facets.leaf_types, origins: facets.origins, aromaBrands: facets.aroma_brands,
    tobaccoBrands: (brands.data ?? []) as { slug: string; name: string }[],
    aromas: ((aromas.data ?? []) as { slug: string; product_name: string }[]).map((a) => ({ slug: a.slug, name: a.product_name })),
  };
});
