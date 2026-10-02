import type { ReactNode } from 'react';

export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string[]; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      {children}
      {hint && !error?.length && <p id={`${name}-hint`} className="mt-1 text-xs text-mute">{hint}</p>}
      {error?.length ? <p id={`${name}-err`} role="alert" className="mt-1 text-xs text-danger">{error[0]}</p> : null}
    </div>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (state.ok) return state.message ? <p role="status" className="rounded-md border border-moss/40 bg-moss/10 px-3 py-2 text-sm text-moss">{state.message}</p> : null;
  return <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>;
}
