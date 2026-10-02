'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateSetting } from '@/lib/actions/admin';

export interface SettingSpec { key: string; label: string; kind: 'text' | 'textarea' | 'number' | 'boolean' | 'announcement'; hint?: string }

function One({ spec, value }: { spec: SettingSpec; value: unknown }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tone, setTone] = useState<string>((value as { tone?: string } | null)?.tone ?? 'info');
  return (
    <form className="card space-y-2 p-4" action={(fd) => start(async () => {
      let v: unknown;
      if (spec.kind === 'boolean') v = fd.get('v') === 'on';
      else if (spec.kind === 'announcement') v = { text: String(fd.get('v') ?? ''), tone };
      else v = String(fd.get('v') ?? '');
      const r = await updateSetting(spec.key, v);
      setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error }); if (r.ok) router.refresh();
    })}>
      <label className="label" htmlFor={`set-${spec.key}`}>{spec.label}</label>
      {spec.kind === 'textarea' ? <textarea id={`set-${spec.key}`} name="v" rows={4} className="field py-2" defaultValue={String(value ?? '')} />
        : spec.kind === 'boolean' ? <label className="flex items-center gap-2 text-sm"><input id={`set-${spec.key}`} type="checkbox" name="v" defaultChecked={Boolean(value)} /> Enabled</label>
        : spec.kind === 'announcement' ? <div className="flex gap-2"><input id={`set-${spec.key}`} name="v" className="field" defaultValue={(value as { text?: string } | null)?.text ?? ''} maxLength={280} placeholder="Leave empty for no banner" /><select aria-label="Tone" className="field w-32" value={tone} onChange={(e) => setTone(e.target.value)}><option value="info">Info</option><option value="warning">Warning</option></select></div>
        : <input id={`set-${spec.key}`} name="v" type={spec.kind === 'number' ? 'number' : 'text'} step="any" className="field" defaultValue={String(value ?? '')} />}
      {spec.hint && <p className="text-xs text-mute">{spec.hint}</p>}
      <div className="flex items-center gap-3"><button className="btn btn-sm btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>{msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-moss' : 'text-danger'}`}>{msg.text}</span>}</div>
    </form>
  );
}

export function SettingsEditor({ specs, values }: { specs: SettingSpec[]; values: Record<string, unknown> }) {
  return <div className="space-y-4">{specs.map((s) => <One key={s.key} spec={s} value={values[s.key]} />)}</div>;
}
