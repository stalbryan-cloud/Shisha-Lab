import Link from 'next/link';
import type { SiteSettings } from '@/lib/site';

export function SiteFooter({ s }: { s: SiteSettings }) {
  return (
    <footer className="mt-20 border-t border-line bg-surface/50 py-10 text-sm text-mute">
      <div className="container grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-2">
          <p className="font-display text-lg text-ink">{s.site_name}</p>
          <p>A community notebook for documenting and discussing homemade shisha tobacco experiments. Not a shop: we do not sell, trade, or link to sales of tobacco.</p>
          <p className="text-xs">{s.health_notice}</p>
        </div>
        <nav aria-label="Footer" className="space-y-1">
          <p className="mb-1 text-xs uppercase tracking-wider">Explore</p>
          <Link className="block hover:text-ink" href="/recipes">Recipes</Link><Link className="block hover:text-ink" href="/explore">Explore</Link><Link className="block hover:text-ink" href="/community">Community</Link><Link className="block hover:text-ink" href="/create">Create a recipe</Link>
        </nav>
        <nav aria-label="Legal" className="space-y-1">
          <p className="mb-1 text-xs uppercase tracking-wider">Rules & notices</p>
          <Link className="block hover:text-ink" href="/rules">Community rules</Link><Link className="block hover:text-ink" href="/about">About & notices</Link>
          <p className="pt-2 text-xs">{s.responsible_use_notice}</p>
        </nav>
      </div>
    </footer>
  );
}
