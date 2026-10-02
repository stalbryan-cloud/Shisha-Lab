'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { featureRecipe, setContentState } from '@/lib/actions/moderation';

export function RecipeAdminActions({ id, featured, moderation }: { id: string; featured: boolean; moderation: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(''); const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error ?? 'Failed'); });
  const why = (q: string) => { const v = window.prompt(q); return v && v.trim().length >= 3 ? v.trim() : null; };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-sm" disabled={pending} onClick={() => run(() => featureRecipe(id, !featured))}>{featured ? 'Unfeature' : 'Feature'}</button>
      {moderation === 'visible'
        ? <><button className="btn btn-sm" disabled={pending} onClick={() => { const w = why('Reason to hide this recipe:'); if (w) run(() => setContentState({ type: 'recipe', id, state: 'hidden', reason: w })); }}>Hide</button>
            <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => { const w = why('Reason to remove this recipe:'); if (w) run(() => setContentState({ type: 'recipe', id, state: 'removed', reason: w })); }}>Remove</button></>
        : <button className="btn btn-sm" disabled={pending} onClick={() => { const w = why('Reason to restore:'); if (w) run(() => setContentState({ type: 'recipe', id, state: 'visible', reason: w })); }}>Restore</button>}
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </div>
  );
}
