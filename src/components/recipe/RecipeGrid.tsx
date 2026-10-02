import { RecipeCard } from './RecipeCard';
import { RecipeCompactRow } from './RecipeCompactRow';
import type { RecipeCardData } from '@/lib/types';

export function RecipeGrid({ items, view = 'grid' }: { items: RecipeCardData[]; view?: 'grid' | 'list' }) {
  if (view === 'list') return <ul className="space-y-2">{items.map((r) => <RecipeCompactRow key={r.id} recipe={r} />)}</ul>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((r, i) => <RecipeCard key={r.id} recipe={r} priority={i < 3} />)}</div>;
}
