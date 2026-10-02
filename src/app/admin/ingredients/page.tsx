import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EntityPanel } from '@/components/admin/EntityPanel';
import { MergeFlavours } from '@/components/admin/MergeFlavours';

export const metadata: Metadata = { title: 'Ingredients · Admin', robots: { index: false } };
type R = Record<string, unknown>;

export default async function AdminIngredients() {
  const viewer = await requireRole(['moderator', 'admin']);
  const supabase = await createClient();
  const [aBrands, aromas, tBrands, tobaccos, leafTypes, flavours, syn] = await Promise.all([
    supabase.from('aroma_brands').select('*').order('name'), supabase.from('aromas').select('*').order('product_name').limit(1000),
    supabase.from('tobacco_brands').select('*').order('name'), supabase.from('tobaccos').select('*').order('product_name').limit(1000),
    supabase.from('tobacco_leaf_types').select('*').order('name'), supabase.from('flavours').select('id, name, slug').is('merged_into', null).order('name').limit(1000),
    supabase.from('flavour_synonyms').select('id, term, flavour_id, concept, category_id').order('term').limit(1000),
  ]);
  const opts = (rows: R[] | null, label: string) => (rows ?? []).map((r) => ({ value: r.id as string, label: r[label] as string }));
  const flav = (flavours.data ?? []) as R[];
  const flavName = new Map(flav.map((f) => [f.id, f.name as string]));
  const admin = viewer.role === 'admin';
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl">Ingredients & flavours</h1><p className="text-sm text-mute">Reference data used by the recipe wizard and search. Informational only — entries have no prices, shop links or availability fields, by design.</p></div>
      <EntityPanel title="Flavours" table="flavours" canDelete={false} fields={[{ key: 'name', label: 'Name', required: true }]} rows={flav} labelOf={(r) => r.name as string} />
      <EntityPanel title="Search synonyms" table="flavour_synonyms" canDelete fields={[{ key: 'term', label: 'Term (what people type)', required: true }, { key: 'flavour_id', label: 'Means flavour', type: 'select', options: opts(flav, 'name') }]} rows={(syn.data ?? []).filter((s: R) => s.flavour_id) as R[]} labelOf={(r) => `${r.term} → ${flavName.get(r.flavour_id) ?? '?'}`} />
      {admin && <MergeFlavours flavours={flav.map((f) => ({ id: f.id as string, name: f.name as string }))} />}
      <EntityPanel title="Aroma brands" table="aroma_brands" canDelete={admin} fields={[{ key: 'name', label: 'Name', required: true }, { key: 'country', label: 'Country' }]} rows={(aBrands.data ?? []) as R[]} labelOf={(r) => `${r.name}${r.is_demo ? ' (demo)' : ''}`} />
      <EntityPanel title="Aromas" table="aromas" canDelete={admin} fields={[{ key: 'product_name', label: 'Product name', required: true }, { key: 'brand_id', label: 'Brand', type: 'select', options: opts(aBrands.data as R[], 'name') }, { key: 'recommended_min_pct', label: 'Recommended min %', type: 'number' }, { key: 'recommended_max_pct', label: 'Recommended max %', type: 'number' }, { key: 'concentration_notes', label: 'Concentration notes' }, { key: 'community_notes', label: 'Community notes' }]} rows={(aromas.data ?? []) as R[]} labelOf={(r) => `${r.product_name}${r.is_demo ? ' (demo)' : ''}`} />
      <EntityPanel title="Tobacco manufacturers" table="tobacco_brands" canDelete={admin} fields={[{ key: 'name', label: 'Name', required: true }, { key: 'country', label: 'Country' }]} rows={(tBrands.data ?? []) as R[]} labelOf={(r) => `${r.name}${r.is_demo ? ' (demo)' : ''}`} />
      <EntityPanel title="Tobacco products" table="tobaccos" canDelete={admin} fields={[{ key: 'product_name', label: 'Product name', required: true }, { key: 'brand_id', label: 'Manufacturer', type: 'select', options: opts(tBrands.data as R[], 'name') }, { key: 'leaf_type_id', label: 'Leaf type', type: 'select', options: opts(leafTypes.data as R[], 'name') }, { key: 'variety', label: 'Variety' }, { key: 'origin', label: 'Origin' }, { key: 'cut', label: 'Cut' }, { key: 'notes', label: 'Notes' }]} rows={(tobaccos.data ?? []) as R[]} labelOf={(r) => `${r.product_name}${r.is_demo ? ' (demo)' : ''}`} />
    </div>
  );
}
