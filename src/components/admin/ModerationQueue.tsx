'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveReport, setContentState, suspendUser, warnUser } from '@/lib/actions/moderation';
import { REPORT_REASON_LABELS } from '@/lib/validators/community';
import { timeAgo } from '@/lib/utils';

export interface QueueItem {
  id: string; target_type: string; target_id: string; reason: keyof typeof REPORT_REASON_LABELS; details: string | null; status: string; priority: number;
  assigned_to: string | null; moderator_notes: string | null; resolution: string | null; created_at: string; reporter_username: string | null;
  preview: string | null; link: string | null; target_user: string | null;
}

type Act = 'in_review' | 'hide' | 'remove' | 'restore' | 'dismiss' | 'resolve' | 'warn' | 'suspend' | 'ban';
const CONTENT = ['recipe', 'comment', 'review', 'experiment', 'forum_topic', 'forum_post'];

function ReportCard({ r, viewerId }: { r: QueueItem; viewerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [act, setAct] = useState<Act>('in_review');
  const [why, setWhy] = useState('');
  const [days, setDays] = useState(7);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const closed = r.status === 'resolved' || r.status === 'dismissed';
  const canContent = CONTENT.includes(r.target_type);
  const needsUser = ['warn', 'suspend', 'ban'].includes(act);

  function submit() {
    setMsg(null);
    start(async () => {
      let res: { ok: boolean; error?: string; message?: string };
      if (act === 'in_review') res = await resolveReport({ reportId: r.id, status: 'in_review', assignToMe: true, notes: why || undefined });
      else if (act === 'dismiss') res = await resolveReport({ reportId: r.id, status: 'dismissed', resolution: why || 'No action needed', notes: why || undefined });
      else if (act === 'resolve') res = await resolveReport({ reportId: r.id, status: 'resolved', resolution: why || 'Resolved', notes: why || undefined });
      else if (act === 'hide' || act === 'remove' || act === 'restore') res = await setContentState({ type: r.target_type as 'recipe', id: r.target_id, state: act === 'hide' ? 'hidden' : act === 'remove' ? 'removed' : 'visible', reason: why, reportId: r.id });
      else if (!r.target_user) res = { ok: false, error: 'The author of this content is no longer available.' };
      else if (act === 'warn') res = await warnUser(r.target_user, why, r.id);
      else res = await suspendUser({ userId: r.target_user, reason: why, days: act === 'suspend' ? days : undefined, permanent: act === 'ban', reportId: r.id });
      if (res.ok) { setMsg({ ok: true, text: res.message ?? 'Done.' }); setWhy(''); router.refresh(); } else setMsg({ ok: false, text: res.error ?? 'Failed' });
    });
  }
  const id = `act-${r.id}`;
  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="chip chip-amber">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span><span className="chip">{r.target_type.replace('_', ' ')}</span>
        <span className="chip capitalize">{r.status.replace('_', ' ')}</span>{r.assigned_to === viewerId && <span className="chip">assigned to you</span>}
        <span>reported {timeAgo(r.created_at)}{r.reporter_username && <> by @{r.reporter_username}</>}</span>
      </div>
      <div>
        {r.link ? <Link href={r.link} className="font-medium text-amber hover:underline" target="_blank">{r.preview || 'Open content'}</Link> : <span className="text-mute">Content no longer exists.</span>}
        {r.details && <p className="mt-1 rounded bg-raised/60 p-2 text-sm text-mute">“{r.details}”</p>}
        {r.resolution && <p className="mt-1 text-xs text-mute">Resolution: {r.resolution}</p>}
      </div>
      {!closed && (
        <form className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]" action={submit}>
          <div><label className="sr-only" htmlFor={`${id}-sel`}>Action</label>
            <select id={`${id}-sel`} className="field" value={act} onChange={(e) => setAct(e.target.value as Act)}>
              <option value="in_review">Take this report</option>
              {canContent && <><option value="hide">Hide content</option><option value="remove">Remove content</option><option value="restore">Restore content</option></>}
              <option value="dismiss">Dismiss (no action)</option><option value="resolve">Mark resolved</option>
              <option value="warn">Warn author</option><option value="suspend">Suspend author</option><option value="ban">Ban author permanently</option>
            </select></div>
          <div className="flex gap-2"><label className="sr-only" htmlFor={`${id}-why`}>Reason (recorded in the audit log)</label>
            <input id={`${id}-why`} className="field" placeholder={['hide', 'remove', 'restore', 'warn', 'suspend', 'ban'].includes(act) ? 'Reason (required, goes in the audit log)' : 'Note (optional)'} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} />
            {act === 'suspend' && <><label className="sr-only" htmlFor={`${id}-d`}>Days</label><input id={`${id}-d`} className="field w-24" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} /></>}</div>
          <button className="btn btn-primary" disabled={pending || (['hide', 'remove', 'restore', 'warn', 'suspend', 'ban'].includes(act) && why.trim().length < 3) || (needsUser && !r.target_user)}>{pending ? 'Working…' : 'Apply'}</button>
        </form>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-moss' : 'text-sm text-danger'}>{msg.text}</p>}
    </li>
  );
}

export function ModerationQueue({ items, viewerId }: { items: QueueItem[]; viewerId: string }) {
  return <ul className="space-y-3">{items.map((r) => <ReportCard key={r.id} r={r} viewerId={viewerId} />)}</ul>;
}
