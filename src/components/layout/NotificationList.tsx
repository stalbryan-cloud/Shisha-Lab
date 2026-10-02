'use client';
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { markAllRead, markRead, deleteNotification } from '@/lib/actions/notifications';
import { timeAgo } from '@/lib/utils';
import type { NotificationRow } from '@/lib/types';

const TEXT: Record<string, string> = {
  comment_reply: 'replied to your comment', topic_reply: 'replied to your topic', mention: 'mentioned you', recipe_reviewed: 'rated your recipe',
  recipe_made: 'logged a result for your recipe', recipe_commented: 'commented on your recipe', saved_recipe_new_version: 'published a new version of a recipe you saved',
  moderation_action: 'A moderator took action on your content', recipe_published: 'published a recipe',
};

function hrefOf(n: NotificationRow) {
  if (n.recipe) return `/recipes/${n.recipe.slug}${n.comment_id ? `#comment-${n.comment_id}` : ''}`;
  if (n.topic) return `/community/t/${n.topic.slug}`;
  return null;
}

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className="btn btn-sm" disabled={pending || items.every((i) => i.read_at)} onClick={() => run(markAllRead)}>Mark all as read</button></div>
      <ul className="space-y-2">
        {items.map((n) => {
          const href = hrefOf(n);
          const label = n.type === 'moderation_action' ? (n.message ?? TEXT.moderation_action) : `${n.actor ? `@${n.actor.username}` : 'Someone'} ${TEXT[n.type] ?? n.type}`;
          const target = n.recipe?.title ?? n.topic?.title;
          return (
            <li key={n.id} className={`card flex items-start justify-between gap-3 p-3 ${n.read_at ? 'opacity-70' : 'border-amber/30'}`}>
              <div className="min-w-0 text-sm">
                {!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber" aria-label="Unread" />}
                {href ? <Link href={href} className="hover:text-amber" onClick={() => { if (!n.read_at) void markRead(n.id); }}>{label}{target && <> — <span className="font-medium">{target}</span></>}</Link> : <span>{label}</span>}
                {n.type !== 'moderation_action' && n.message && <p className="mt-0.5 text-xs text-mute">{n.message}</p>}
                <p className="text-xs text-mute">{timeAgo(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs text-mute">
                {!n.read_at && <button className="hover:text-ink" disabled={pending} onClick={() => run(() => markRead(n.id))}>Mark read</button>}
                <button className="hover:text-danger" disabled={pending} aria-label="Delete notification" onClick={() => run(() => deleteNotification(n.id))}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
