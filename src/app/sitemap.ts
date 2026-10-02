import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

export const revalidate = 3600;

/** Public, indexable URLs only: published + public + visible recipes, forum topics, and member profiles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const entries: MetadataRoute.Sitemap = ['', '/recipes', '/explore', '/community', '/rules', '/about'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'daily', priority: p === '' ? 1 : 0.7 }));
  try {
    const supabase = await createClient();
    const [recipes, topics, profiles] = await Promise.all([
      supabase.from('recipes').select('slug, updated_at').eq('status', 'published').eq('visibility', 'public').eq('moderation', 'visible').order('updated_at', { ascending: false }).limit(5000),
      supabase.from('forum_topics').select('slug, last_activity_at').in('status', ['open', 'locked']).order('last_activity_at', { ascending: false }).limit(5000),
      supabase.from('profiles').select('username, updated_at').eq('is_anonymized', false).limit(5000),
    ]);
    for (const r of recipes.data ?? []) entries.push({ url: `${base}/recipes/${r.slug}`, lastModified: r.updated_at, changeFrequency: 'weekly', priority: 0.8 });
    for (const t of topics.data ?? []) entries.push({ url: `${base}/community/t/${t.slug}`, lastModified: t.last_activity_at, changeFrequency: 'weekly', priority: 0.5 });
    for (const p of profiles.data ?? []) entries.push({ url: `${base}/u/${p.username}`, lastModified: p.updated_at, changeFrequency: 'monthly', priority: 0.3 });
  } catch { /* database unavailable at build time: static entries only */ }
  return entries;
}
