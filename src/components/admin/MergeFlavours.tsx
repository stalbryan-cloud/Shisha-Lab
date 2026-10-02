'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mergeFlavours } from '@/lib/actions/admin';

export function MergeFlavours({ flavours }: { flavours: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]" action={(fd) => {
      const from = String(fd.get('from')), into = String(fd.get('into'));
      if (!from || !into || from === into) { setMsg({ ok: false, text: 'Choose two different flavours.' }); return; }
      if (!confirm('Merge? Recipes using the first flavour move to the second, and the old name becomes a synonym.')) return;
      start(async () => { const r = await mergeFlavours(from, into, 'Merged via admin'); setMsg(r.ok ? { ok: true, text: r.message ?? 'Merged.' } : { ok: false, text: r.error }); if (r.ok) router.refresh(); });
    }}>
      <div><label className="label" htmlFor="m-from">Merge this flavour…</label><select id="m-from" name="from" className="field" defaultValue=""><option value="" disabled>Choose…</option>{flavours.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
      <div><label className="label" htmlFor="m-into">…into this one</label><select id="m-into" name="into" className="field" defaultValue=""><option value="" disabled>Choose…</option>{flavours.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
      <div className="flex items-end"><button className="btn btn-primary" disabled={pending}>{pending ? 'Merging…' : 'Merge'}</button></div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`sm:col-span-3 text-sm ${msg.ok ? 'text-moss' : 'text-danger'}`}>{msg.text}</p>}
    </form>
  );
}
