'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { logout } from '@/lib/actions/auth';

export function UserMenu({ username, displayName, avatarPath, role }: { username: string; displayName: string | null; avatarPath: string | null; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);
  const item = 'block px-4 py-2 text-sm hover:bg-raised';
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-ghost gap-2 px-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ProfileAvatar profile={{ username, display_name: displayName, avatar_path: avatarPath }} size={28} />
        <span className="hidden max-w-[8rem] truncate text-sm lg:inline">{displayName || username}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-pop" onClick={() => setOpen(false)}>
          <Link role="menuitem" className={item} href={`/u/${username}`}>My public profile</Link>
          <Link role="menuitem" className={item} href="/me">Dashboard</Link>
          <Link role="menuitem" className={item} href="/me?tab=saved">Saved recipes</Link>
          <Link role="menuitem" className={item} href="/settings">Settings</Link>
          {(role === 'moderator' || role === 'admin') && <Link role="menuitem" className={item} href="/moderation">Moderation</Link>}
          {role === 'admin' && <Link role="menuitem" className={item} href="/admin">Admin</Link>}
          <form action={logout}><button role="menuitem" className={`${item} w-full text-left text-ember`}>Log out</button></form>
        </div>
      )}
    </div>
  );
}
