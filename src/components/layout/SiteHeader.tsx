import Link from 'next/link';
import { FlaskConical, Plus } from 'lucide-react';
import { getViewer, isStaff } from '@/lib/auth';
import { SearchAutocomplete } from './SearchAutocomplete';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { MobileNav } from './MobileNav';

const LINKS = [
  { href: '/', label: 'Home' }, { href: '/recipes', label: 'Recipes' }, { href: '/explore', label: 'Explore' },
  { href: '/community', label: 'Community' },
];

export async function SiteHeader({ siteName }: { siteName: string }) {
  const viewer = await getViewer();
  const links = [...LINKS, { href: '/create', label: 'Create' }, ...(viewer ? [{ href: '/me', label: 'Profile' }] : [{ href: '/login', label: 'Log in' }, { href: '/signup', label: 'Sign up' }]),
    ...(isStaff(viewer?.role) ? [{ href: '/moderation', label: 'Moderation' }] : []), ...(viewer?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="container flex h-14 items-center gap-3">
        <MobileNav links={links} />
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg tracking-wide">
          <FlaskConical className="text-amber" size={22} aria-hidden /><span>{siteName}</span>
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-mute hover:bg-raised hover:text-ink">{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden w-full max-w-xs lg:block"><SearchAutocomplete /></div>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Link href="/search" className="btn btn-ghost px-2.5 lg:hidden" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></Link>
          <Link href="/create" className="btn btn-primary btn-sm hidden sm:inline-flex"><Plus size={14} aria-hidden /> Create</Link>
          {viewer ? (
            <>
              <NotificationBell userId={viewer.id} />
              <UserMenu username={viewer.profile.username} displayName={viewer.profile.display_name} avatarPath={viewer.profile.avatar_path} role={viewer.role} />
            </>
          ) : (
            <span className="hidden items-center gap-1 md:flex"><Link href="/login" className="btn btn-ghost btn-sm">Log in</Link><Link href="/signup" className="btn btn-sm">Sign up</Link></span>
          )}
        </div>
      </div>
    </header>
  );
}
