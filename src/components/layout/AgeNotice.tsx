'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * One-time adults-only acknowledgement. Stored in a first-party cookie (no personal data). The wording is admin-configurable
 * in site settings. Dismissal is NOT age verification; it records that the visitor was shown the notice.
 */
export function AgeNotice({ ageNotice, responsible, jurisdiction, health, rulesHref }: { ageNotice: string; responsible: string; jurisdiction: string; health: string; rulesHref: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!/(^|; )sl_age=1/.test(document.cookie)) setShow(true); }, []);
  useEffect(() => { if (show) ref.current?.showModal(); }, [show]);
  if (!show) return null;
  function accept() {
    document.cookie = 'sl_age=1; path=/; max-age=31536000; samesite=lax';
    ref.current?.close(); setShow(false);
  }
  function leave() { window.location.href = 'https://www.google.com'; }
  return (
    <dialog ref={ref} onCancel={(e) => e.preventDefault()} aria-labelledby="age-h" className="w-[min(92vw,34rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/85">
      <div className="space-y-4 p-6">
        <h2 id="age-h" className="font-display text-2xl">Before you enter the lab</h2>
        <p className="text-sm">{ageNotice}</p>
        <p className="text-sm text-mute">{responsible}</p>
        <p className="text-sm text-mute">{jurisdiction}</p>
        <p className="text-sm text-mute">{health}</p>
        <p className="text-xs text-mute">By continuing you agree to the <a className="text-amber underline" href={rulesHref}>community rules</a>.</p>
        <div className="flex flex-wrap justify-end gap-2"><button className="btn" onClick={leave}>I’m not of legal age</button><button className="btn btn-primary" onClick={accept} autoFocus>I am of legal age — enter</button></div>
      </div>
    </dialog>
  );
}
