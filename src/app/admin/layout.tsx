import Link from 'next/link';
import { requireRole } from '@/lib/auth';

const NAV = [['/admin', 'Dashboard'], ['/admin/users', 'Users'], ['/admin/recipes', 'Recipes'], ['/admin/ingredients', 'Ingredients & flavours'], ['/admin/forum', 'Forum'], ['/moderation', 'Reports'], ['/admin/site', 'Site settings'], ['/admin/audit', 'Audit log']];

/** Server-side gate for the whole /admin tree. Moderators may open it (read + curation); role changes and settings re-check "admin" in the database. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['moderator', 'admin']);
  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Admin" className="lg:sticky lg:top-20 lg:self-start"><ul className="flex gap-1 overflow-x-auto lg:flex-col">{NAV.map(([h, l]) => <li key={h}><Link href={h} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-mute hover:bg-raised hover:text-ink">{l}</Link></li>)}</ul></nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
