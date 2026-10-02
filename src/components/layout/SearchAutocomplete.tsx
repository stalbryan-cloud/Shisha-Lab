'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Item { kind: string; label: string; slug: string }
const KIND_LABEL: Record<string, string> = { flavour: 'Flavour', aroma: 'Aroma', recipe: 'Recipe', tag: 'Tag', tobacco: 'Tobacco', user: 'Member' };

function hrefFor(i: Item) {
  switch (i.kind) {
    case 'recipe': return `/recipes/${i.slug}`;
    case 'user': return `/u/${i.slug}`;
    case 'tag': return `/recipes?tag=${i.slug}`;
    default: return `/search?q=${encodeURIComponent(i.label)}`;
  }
}

/** Accessible combobox (ARIA 1.2 pattern). Enter with no active option submits a full search. */
export function SearchAutocomplete({ defaultValue = '', size = 'md', autoFocus }: { defaultValue?: string; size?: 'md' | 'lg'; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(defaultValue);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (res.ok) { setItems((await res.json()).items as Item[]); setActive(-1); }
      } catch { /* aborted */ }
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function go(i?: Item) {
    setOpen(false);
    router.push(i ? hrefFor(i) : `/search?q=${encodeURIComponent(q.trim())}`);
  }
  const listId = `${id}-list`;
  return (
    <div ref={box} className="relative w-full" role="search">
      <form onSubmit={(e) => { e.preventDefault(); if (active >= 0 && items[active]) go(items[active]); else if (q.trim()) go(); }}>
        <label htmlFor={`${id}-input`} className="sr-only">Search recipes, flavours and aromas</label>
        <Search size={size === 'lg' ? 20 : 16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
        <input
          id={`${id}-input`} type="search" autoComplete="off" autoFocus={autoFocus} value={q} placeholder="Search flavours, aromas, recipes…"
          className={cn('field pl-10', size === 'lg' && 'min-h-14 text-base sm:min-h-14 sm:text-lg')}
          role="combobox" aria-expanded={open && items.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
      </form>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 max-h-80 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-pop">
          {items.map((it, i) => (
            <li key={`${it.kind}-${it.slug}-${i}`} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm', i === active ? 'bg-raised' : 'hover:bg-raised')}
              onMouseDown={(e) => { e.preventDefault(); go(it); }}>
              <span>{it.label}</span><span className="text-xs text-mute">{KIND_LABEL[it.kind] ?? it.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
