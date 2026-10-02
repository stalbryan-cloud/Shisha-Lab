import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Link-based tabs (state lives in the URL, so they work without JS and are shareable). */
export function Tabs({ tabs, current, hrefFor, label }: { tabs: { key: string; label: string; count?: number }[]; current: string; hrefFor: (key: string) => string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-line px-4">
      <ul className="flex gap-1 whitespace-nowrap">
        {tabs.map((t) => (
          <li key={t.key}><Link href={hrefFor(t.key)} aria-current={t.key === current ? 'page' : undefined} className={cn('inline-block border-b-2 px-4 py-2.5 text-sm', t.key === current ? 'border-amber text-amber' : 'border-transparent text-mute hover:text-ink')}>
            {t.label}{t.count != null && <span className="ml-1.5 text-xs opacity-70">{t.count}</span>}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
