'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteEntity, saveEntity } from '@/lib/actions/admin';

type Table = Parameters<typeof saveEntity>[0];
export interface FieldSpec { key: string; label: string; type?: 'text' | 'number' | 'select'; options?: { value: string; label: string }[]; required?: boolean }

/** Generic create/edit/delete list for reference data (brands, aromas, tobaccos, flavours, synonyms). Informational only — there is deliberately no price, URL or shop field. */
export function EntityPanel({ title, table, fields, rows, labelOf, canDelete }: { title: string; table: Table; fields: FieldSpec[]; rows: Record<string, unknown>[]; labelOf: (r: Record<string, unknown>) => string; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState('');

  function submit(fd: FormData, id?: string) {
    const input: Record<string, unknown> = id ? { id } : {};
    for (const f of fields) { const v = fd.get(f.key); input[f.key] = v === null || v === '' ? (f.type === 'number' || f.type === 'select' ? null : undefined) : v; }
    start(async () => {
      const r = await saveEntity(table, input as never);
      if (r.ok) { setMsg({ ok: true, text: 'Saved.' }); setEditing(null); router.refresh(); } else setMsg({ ok: false, text: r.error });
    });
  }
  const form = (row?: Record<string, unknown>) => (
    <form className="grid gap-3 sm:grid-cols-2" action={(fd) => submit(fd, row?.id as string | undefined)}>
      {fields.map((f) => (
        <div key={f.key}><label className="label" htmlFor={`${table}-${row?.id ?? 'new'}-${f.key}`}>{f.label}</label>
          {f.type === 'select' ? <select id={`${table}-${row?.id ?? 'new'}-${f.key}`} name={f.key} className="field" defaultValue={(row?.[f.key] as string) ?? ''}><option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input id={`${table}-${row?.id ?? 'new'}-${f.key}`} name={f.key} type={f.type === 'number' ? 'number' : 'text'} step={f.type === 'number' ? 'any' : undefined} className="field" defaultValue={(row?.[f.key] as string | number | undefined) ?? ''} required={f.required} />}</div>
      ))}
      <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
    </form>
  );
  const shown = rows.filter((r) => labelOf(r).toLowerCase().includes(filter.toLowerCase())).slice(0, 200);
  return (
    <section className="card space-y-3 p-4" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-xl">{title} <span className="text-sm text-mute">({rows.length})</span></h2>
        <div className="flex gap-2"><label className="sr-only" htmlFor={`f-${table}`}>Filter {title}</label><input id={`f-${table}`} className="field min-h-8 w-48 text-xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} /><button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>Add</button></div></div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-moss' : 'text-sm text-danger'}>{msg.text}</p>}
      {editing === 'new' && <div className="rounded-md border border-line p-3">{form()}</div>}
      <ul className="max-h-96 divide-y divide-line/60 overflow-auto text-sm">
        {shown.map((r) => (
          <li key={r.id as string} className="py-2">
            <div className="flex items-center justify-between gap-2"><span>{labelOf(r)}</span>
              <span className="flex gap-3 text-xs"><button className="text-mute hover:text-amber" onClick={() => setEditing(editing === r.id ? null : (r.id as string))}>Edit</button>
                {canDelete && <button className="text-mute hover:text-danger" disabled={pending} onClick={() => { if (confirm(`Delete “${labelOf(r)}”? Recipes that reference it keep their text.`)) start(async () => { const x = await deleteEntity(table as never, r.id as string); if (x.ok) router.refresh(); else setMsg({ ok: false, text: x.error }); }); }}>Delete</button>}</span></div>
            {editing === r.id && <div className="mt-2 rounded-md border border-line p-3">{form(r)}</div>}
          </li>
        ))}
        {shown.length === 0 && <li className="py-4 text-center text-mute">Nothing matches.</li>}
      </ul>
    </section>
  );
}
