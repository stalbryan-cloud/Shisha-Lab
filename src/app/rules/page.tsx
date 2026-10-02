import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site';
import { renderMarkdown } from '@/lib/core/markdown';

export const metadata: Metadata = { title: 'Community rules' };

export default async function RulesPage() {
  const s = await getSiteSettings();
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="font-display text-3xl">Community rules</h1>
      <div className="prose-lab mt-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.community_rules) }} />
      <p className="mt-6 text-sm text-mute">Breaking these rules can lead to content removal, warnings, suspension or a ban. You can report content from any recipe, comment or forum post.</p>
    </div>
  );
}
