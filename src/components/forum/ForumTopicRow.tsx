import Link from 'next/link';
import { Pin, Lock, MessageSquare, Eye, ArrowUp, Sparkles } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { TopicRow } from '@/lib/types';

export function ForumTopicRow({ topic: t }: { topic: TopicRow }) {
  return (
    <li className="card relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:border-amber/40">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          {t.is_pinned && <span className="chip chip-amber py-0 text-[11px]"><Pin size={11} aria-hidden /> Pinned</span>}
          {t.is_featured && <span className="chip chip-amber py-0 text-[11px]"><Sparkles size={11} aria-hidden /> Featured</span>}
          {t.status === 'locked' && <span className="chip py-0 text-[11px]"><Lock size={11} aria-hidden /> Locked</span>}
          <Link href={`/community/t/${t.slug}`} className="font-display text-base after:absolute after:inset-0 hover:text-amber">{t.title}</Link>
        </div>
        <p className="mt-0.5 text-xs text-mute">
          {t.category && <span className="mr-2 text-amber/80">{t.category.name}</span>}
          by {t.author ? `@${t.author.username}` : '[deleted user]'} · {timeAgo(t.last_activity_at)}
          {t.tags?.slice(0, 3).map((g) => <span key={g.slug} className="ml-2">#{g.name}</span>)}
        </p>
      </div>
      <dl className="flex items-center gap-4 text-xs text-mute">
        <div className="flex items-center gap-1" title="Replies"><MessageSquare size={13} aria-hidden /><dt className="sr-only">Replies</dt><dd>{t.reply_count}</dd></div>
        <div className="flex items-center gap-1" title="Upvotes"><ArrowUp size={13} aria-hidden /><dt className="sr-only">Upvotes</dt><dd>{t.upvotes}</dd></div>
        <div className="flex items-center gap-1" title="Views"><Eye size={13} aria-hidden /><dt className="sr-only">Views</dt><dd>{t.views}</dd></div>
      </dl>
    </li>
  );
}
