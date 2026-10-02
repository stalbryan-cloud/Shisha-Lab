'use client';
import { useState, useTransition } from 'react';
import { getSourceFileUrl } from '@/lib/actions/uploads';

/** Fetches a short-lived signed URL on click, so uploaded files are never publicly addressable. */
export function SourceFileLink({ path }: { path: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <>
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => start(async () => {
        const res = await getSourceFileUrl(path);
        if (res.ok && res.data) window.open(res.data.url, '_blank', 'noopener');
        else setErr(res.ok ? 'Unavailable' : res.error);
      })}>{pending ? 'Opening…' : 'Open file'}</button>
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </>
  );
}
