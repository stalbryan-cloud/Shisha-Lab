'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveCategory, reorderCategories, saveCategory, setCategoryModerator } from '@/lib/actions/admin';

export interface CatVM { id: string; name: string; description: string | null; is_archived: boolean; moderators: string[] }

export function CategoryManager({ categories }: { categories: CatVM[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? 'Saved.' } : { ok: false, text: r.error ?? 'Failed' }); if (r.ok) router.refresh(); });
  const move = (i: number, d: number) => { const ids = categories.map((c) => c.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; run(() => reorderCategories(ids)); };
  return (
    <div className="space-y-4">
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-moss' : 'text-sm text-danger'}>{msg.text}</p>}
      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_2fr_auto]" action={(fd) => run(async () => saveCategory({ name: String(fd.get('name')), description: String(fd.get('description') ?? '') }))}>
        <div><label className="label" htmlFor="nc-name">New category</label><input id="nc-name" name="name" required minLength={2} maxLength={60} className="field" /></div>
        <div><label className="label" htmlFor="nc-desc">Description</label><input id="nc-desc" name="description" maxLength={200} className="field" /></div>
        <div className="flex items-end"><button className="btn btn-primary" disabled={pending}>Add</button></div>
      </form>
      <ul className="space-y-2">
        {categories.map((c, i) => (
          <li key={c.id} className={`card p-3 ${c.is_archived ? 'opacity-60' : ''}`}>
            <form className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]" action={(fd) => run(async () => saveCategory({ id: c.id, name: String(fd.get('name')), description: String(fd.get('description') ?? '') }))}>
              <input aria-label="Name" name="name" defaultValue={c.name} className="field" /><input aria-label="Description" name="description" defaultValue={c.description ?? ''} className="field" />
              <div className="flex flex-wrap gap-2"><button className="btn btn-sm" disabled={pending}>Save</button>
                <button type="button" className="btn btn-sm" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`}>↑</button>
                <button type="button" className="btn btn-sm" disabled={pending || i === categories.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`}>↓</button>
                <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(() => archiveCategory(c.id, !c.is_archived))}>{c.is_archived ? 'Unarchive' : 'Archive'}</button></div>
            </form>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute"><span>Moderators:</span>
              {c.moderators.map((m) => <span key={m} className="chip">@{m}<button className="ml-1" aria-label={`Remove ${m}`} onClick={() => run(() => setCategoryModerator(c.id, m, false))}>×</button></span>)}
              <form className="flex gap-1" action={(fd) => run(() => setCategoryModerator(c.id, String(fd.get('u')), true))}><label className="sr-only" htmlFor={`mod-${c.id}`}>Add moderator username</label><input id={`mod-${c.id}`} name="u" className="field min-h-8 w-36 text-xs" placeholder="username" /><button className="btn btn-sm">Add</button></form></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
