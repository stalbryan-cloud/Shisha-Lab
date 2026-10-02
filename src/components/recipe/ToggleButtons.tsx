'use client';
import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Heart } from 'lucide-react';
import { setLike, setSave } from '@/lib/actions/social';
import { cn } from '@/lib/utils';

function Toggle({ initial, count, action, icon, labelOn, labelOff, loginHref, signedIn, recipeId, slug, showCount }: {
  initial: boolean; count: number; action: (id: string, on: boolean, slug?: string) => Promise<{ ok: boolean; error?: string }>;
  icon: 'heart' | 'bookmark'; labelOn: string; labelOff: string; loginHref: string; signedIn: boolean; recipeId: string; slug: string; showCount: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ on: initial, count });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const Icon = icon === 'heart' ? Heart : Bookmark;

  function click() {
    if (!signedIn) { router.push(loginHref); return; }
    const next = !state.on;
    setError(null);
    start(async () => {
      setOptimistic({ on: next, count: state.count + (next ? 1 : -1) });
      const res = await action(recipeId, next, slug);
      if (res.ok) setState({ on: next, count: state.count + (next ? 1 : -1) });
      else setError(res.error ?? 'Could not save that.');
    });
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={click} aria-pressed={optimistic.on} disabled={pending} className={cn('btn', optimistic.on && 'border-amber/60 text-amber')}>
        <Icon size={16} className={optimistic.on ? 'fill-amber' : ''} aria-hidden />
        {optimistic.on ? labelOn : labelOff}{showCount && <span className="text-mute">{optimistic.count}</span>}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}

export function LikeButton(p: { recipeId: string; slug: string; liked: boolean; count: number; signedIn: boolean }) {
  return <Toggle initial={p.liked} count={p.count} action={setLike} icon="heart" labelOn="Liked" labelOff="Like" loginHref={`/login?next=/recipes/${p.slug}`} signedIn={p.signedIn} recipeId={p.recipeId} slug={p.slug} showCount />;
}
/** Saves are private bookmarks — the count is not shown on the button. */
export function SaveButton(p: { recipeId: string; slug: string; saved: boolean; count: number; signedIn: boolean }) {
  return <Toggle initial={p.saved} count={p.count} action={setSave} icon="bookmark" labelOn="Saved" labelOff="Save" loginHref={`/login?next=/recipes/${p.slug}`} signedIn={p.signedIn} recipeId={p.recipeId} slug={p.slug} showCount={false} />;
}
