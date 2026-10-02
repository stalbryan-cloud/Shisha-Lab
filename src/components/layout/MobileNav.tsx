'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="md:hidden">
      <button type="button" className="btn btn-ghost px-2.5" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="fixed inset-x-0 top-14 z-40 h-[calc(100dvh-3.5rem)] overflow-auto border-t border-line bg-bg p-4 animate-fade-up">
          <ul className="space-y-1">
            {links.map((l) => <li key={l.href}><Link href={l.href} className="block rounded-md px-3 py-3 font-display text-xl hover:bg-raised">{l.label}</Link></li>)}
          </ul>
        </nav>
      )}
    </div>
  );
}
