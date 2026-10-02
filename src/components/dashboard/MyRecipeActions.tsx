'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteDraft, setRecipeArchived, setRecipeVisibility } from '@/lib/actions/recipes';

export function MyRecipeActions({ id, slug, status, visibility }: { id: string; slug: string; status: string; visibility: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(''); const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error ?? 'Failed'); });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/recipes/${slug}/edit`} className="btn btn-sm">{status === 'draft' ? 'Continue editing' : 'Edit'}</Link>
      {status !== 'draft' && <Link href={`/recipes/${slug}`} className="btn btn-sm">View</Link>}
      {status !== 'draft' && (
        <label className="inline-flex items-center gap-1 text-xs text-mute">Visibility
          <select className="field min-h-8 w-auto py-0 text-xs" value={visibility} disabled={pending} onChange={(e) => run(() => setRecipeVisibility(id, e.target.value as 'public' | 'unlisted' | 'private'))}>
            <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label>)}
      {status === 'published' && <button className="btn btn-sm" disabled={pending} onClick={() => { if (confirm('Archive this recipe? It disappears from listings but keeps its history and can be restored.')) run(() => setRecipeArchived(id, true)); }}>Archive</button>}
      {status === 'archived' && <button className="btn btn-sm" disabled={pending} onClick={() => run(() => setRecipeArchived(id, false))}>Restore</button>}
      {status === 'draft' && <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => { if (confirm('Delete this draft permanently?')) run(() => deleteDraft(id)); }}>Delete draft</button>}
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </div>
  );
}
