'use client';
import { useState } from 'react';
import { Share2, Printer } from 'lucide-react';

export function ShareButton({ title }: { title: string }) {
  const [msg, setMsg] = useState('');
  async function share() {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setMsg('Link copied');
    } catch { setMsg('Copy the address from your browser bar'); }
    setTimeout(() => setMsg(''), 2500);
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn" onClick={share}><Share2 size={16} aria-hidden /> Share</button>
      <span role="status" className="text-xs text-mute">{msg}</span>
    </span>
  );
}
export function PrintButton() {
  return <button type="button" className="btn no-print" onClick={() => window.print()}><Printer size={16} aria-hidden /> Print</button>;
}
