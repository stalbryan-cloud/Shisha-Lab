'use client';
import { useRef, useState, useTransition } from 'react';
import { Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { submitReport } from '@/lib/actions/reports';
import { REPORT_REASONS, REPORT_REASON_LABELS } from '@/lib/validators/community';
import type { ReportTarget } from '@/lib/types';

export function ReportDialog({ targetType, targetId, signedIn, label = 'Report', compact }: { targetType: ReportTarget; targetId: string; signedIn: boolean; label?: string; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  function open() {
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setResult(null); ref.current?.showModal();
  }
  function submit(fd: FormData) {
    start(async () => {
      const res = await submitReport({ target_type: targetType, target_id: targetId, reason: fd.get('reason'), details: fd.get('details') });
      setResult(res.ok ? { ok: true, message: res.message } : { ok: false, message: res.error });
      if (res.ok) setTimeout(() => ref.current?.close(), 1400);
    });
  }
  return (
    <>
      <button type="button" onClick={open} className={compact ? 'inline-flex items-center gap-1 text-xs text-mute hover:text-ember' : 'btn'}>
        <Flag size={compact ? 12 : 16} aria-hidden /> {label}
      </button>
      <dialog ref={ref} aria-labelledby={`rd-${targetId}`} className="w-[min(92vw,28rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/70">
        <form action={submit} className="space-y-4 p-5">
          <h2 id={`rd-${targetId}`} className="font-display text-xl">Report this content</h2>
          <p className="text-sm text-mute">Reports go to the moderation team. Please tell us what is wrong.</p>
          <div>
            <label className="label" htmlFor={`reason-${targetId}`}>Reason</label>
            <select id={`reason-${targetId}`} name="reason" required className="field" defaultValue="">
              <option value="" disabled>Choose a reason…</option>
              {REPORT_REASONS.map((v) => <option key={v} value={v}>{REPORT_REASON_LABELS[v]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`details-${targetId}`}>Details (optional)</label>
            <textarea id={`details-${targetId}`} name="details" maxLength={1000} rows={3} className="field py-2" />
          </div>
          {result && <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'text-sm text-moss' : 'text-sm text-danger'}>{result.message}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Sending…' : 'Send report'}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
