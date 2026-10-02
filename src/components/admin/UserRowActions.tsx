'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeRole } from '@/lib/actions/admin';
import { liftSuspension, suspendUser, warnUser } from '@/lib/actions/moderation';

export function UserRowActions({ userId, username, role, suspended, isAdmin, isSelf }: { userId: string; username: string; role: string; suspended: boolean; isAdmin: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(''); const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error ?? 'Failed'); });
  const ask = (q: string) => { const v = window.prompt(q); return v && v.trim().length >= 3 ? v.trim() : null; };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && !isSelf && (
        <select aria-label={`Role for ${username}`} className="field min-h-8 w-auto py-0 text-xs" value={role} disabled={pending} onChange={(e) => { const r = e.target.value as 'user' | 'trusted_user' | 'moderator' | 'admin'; if (confirm(`Change ${username} to ${r}?`)) run(() => changeRole(userId, r)); }}>
          <option value="user">user</option><option value="trusted_user">trusted_user</option><option value="moderator">moderator</option><option value="admin">admin</option></select>)}
      {!isSelf && role !== 'admin' && (<>
        <button className="btn btn-sm" disabled={pending} onClick={() => { const w = ask(`Warning for @${username} (reason, 3+ characters):`); if (w) run(() => warnUser(userId, w)); }}>Warn</button>
        {suspended ? <button className="btn btn-sm" disabled={pending} onClick={() => run(() => liftSuspension(userId))}>Lift suspension</button>
          : <>
            <button className="btn btn-sm" disabled={pending} onClick={() => { const w = ask(`Reason to suspend @${username}:`); if (!w) return; const d = Number(window.prompt('Days (1–365):', '7')); if (d >= 1 && d <= 365) run(() => suspendUser({ userId, reason: w, days: d })); }}>Suspend</button>
            <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => { const w = ask(`Reason to ban @${username} permanently:`); if (w && confirm('Ban permanently?')) run(() => suspendUser({ userId, reason: w, permanent: true })); }}>Ban</button></>}
      </>)}
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </div>
  );
}
