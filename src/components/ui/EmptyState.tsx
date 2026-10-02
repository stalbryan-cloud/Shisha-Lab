import Link from 'next/link';
import type { ReactNode } from 'react';

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: { href: string; label: string } | ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-amber" aria-hidden>{icon}</div>}
      <h3 className="font-display text-lg">{title}</h3>
      {body && <p className="max-w-md text-sm text-mute">{body}</p>}
      {action && (typeof action === 'object' && 'href' in (action as object) && 'label' in (action as object)
        ? <Link href={(action as { href: string }).href} className="btn btn-primary mt-1">{(action as { label: string }).label}</Link>
        : action)}
    </div>
  );
}
