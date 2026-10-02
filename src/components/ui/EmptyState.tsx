import Link from 'next/link';
import type { ReactNode } from 'react';

export type EmptyAction = { href: string; label: string };

function isLinkAction(a: unknown): a is EmptyAction {
  return typeof a === 'object' && a !== null && 'href' in a && 'label' in a && typeof (a as EmptyAction).href === 'string';
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: EmptyAction | ReactNode }) {
  let actionNode: ReactNode = null;
  if (isLinkAction(action)) actionNode = <Link href={action.href} className="btn btn-primary mt-1">{action.label}</Link>;
  else if (action) actionNode = action as ReactNode;
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-amber" aria-hidden>{icon}</div>}
      <h3 className="font-display text-lg">{title}</h3>
      {body && <p className="max-w-md text-sm text-mute">{body}</p>}
      {actionNode}
    </div>
  );
}
