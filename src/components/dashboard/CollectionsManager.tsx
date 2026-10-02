'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCollection, deleteCollection, setInCollection } from '@/lib/actions/social';

export interface CollectionVM { id: string; name: string; recipes: { id: string; slug: string; title: string }[] }

export function CollectionsManager({ collections, saved }: { collections: CollectionVM[]; saved: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(''); const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error ?? 'Failed'); });
  return (
    <div className="space-y-6">
      <form className="flex max-w-md gap-2" action={() => run(async () => { const r = await createCollection(name); if (r.ok) setName(''); return r; })}>
        <label className="sr-only" htmlFor="coll-name">Collection name</label>
        <input id="coll-name" className="field" maxLength={60} placeholder="New collection, e.g. “To try this winter”" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={pending || !name.trim()}>Create</button>
      </form>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <p className="text-xs text-mute">Collections are private — only you can see them.</p>
      {collections.length === 0 && <p className="text-sm text-mute">No collections yet.</p>}
      <ul className="grid gap-4 md:grid-cols-2">
        {collections.map((c) => (
          <li key={c.id} className="card p-4">
            <div className="flex items-center justify-between"><h3 className="font-display text-lg">{c.name}</h3><button className="text-xs text-mute hover:text-danger" disabled={pending} onClick={() => { if (confirm(`Delete “${c.name}”? Recipes stay saved.`)) run(() => deleteCollection(c.id)); }}>Delete</button></div>
            <ul className="mt-2 space-y-1 text-sm">{c.recipes.map((r) => <li key={r.id} className="flex justify-between gap-2"><Link className="hover:text-amber" href={`/recipes/${r.slug}`}>{r.title}</Link><button className="text-xs text-mute hover:text-danger" aria-label={`Remove ${r.title} from ${c.name}`} onClick={() => run(() => setInCollection(c.id, r.id, false))}>remove</button></li>)}{c.recipes.length === 0 && <li className="text-mute">Empty</li>}</ul>
            {saved.filter((s) => !c.recipes.some((r) => r.id === s.id)).length > 0 && (
              <div className="mt-3"><label className="sr-only" htmlFor={`add-${c.id}`}>Add a saved recipe</label>
                <select id={`add-${c.id}`} className="field" value="" onChange={(e) => e.target.value && run(() => setInCollection(c.id, e.target.value, true))}><option value="">Add a saved recipe…</option>{saved.filter((s) => !c.recipes.some((r) => r.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>)}
          </li>
        ))}
      </ul>
    </div>
  );
}
