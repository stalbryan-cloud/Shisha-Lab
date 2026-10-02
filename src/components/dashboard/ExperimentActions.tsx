'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteExperiment, updateExperimentVisibility } from '@/lib/actions/reviews';

export function ExperimentActions({ id, visibility }: { id: string; visibility: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="inline-flex items-center gap-1 text-mute">Visible to
        <select className="field min-h-8 w-auto py-0 text-xs" value={visibility} disabled={pending} onChange={(e) => start(async () => { const r = await updateExperimentVisibility(id, e.target.value as 'public' | 'followers' | 'private'); if (r.ok) router.refresh(); else setErr(r.error); })}>
          <option value="public">Everyone</option><option value="followers">Followers</option><option value="private">Only me</option></select></label>
      <button className="text-mute hover:text-danger" disabled={pending} onClick={() => { if (confirm('Delete this result?')) start(async () => { const r = await deleteExperiment(id); if (r.ok) router.refresh(); else setErr(r.error); }); }}>Delete</button>
      {err && <span role="alert" className="text-danger">{err}</span>}
    </div>
  );
}
