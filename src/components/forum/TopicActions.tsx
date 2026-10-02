'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Bell, ArrowUp } from 'lucide-react';
import { setBookmark, setFollow, voteForum } from '@/lib/actions/forum';
import { setTopicFlags } from '@/lib/actions/moderation';

export function TopicActions({ topicId, slug, signedIn, bookmarked, following, voted, upvotes, staff, status, pinned, featured }: {
  topicId: string; slug: string; signedIn: boolean; bookmarked: boolean; following: boolean; voted: boolean; upvotes: number;
  staff: boolean; status: string; pinned: boolean; featured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState({ bookmarked, following, voted, upvotes });
  const [err, setErr] = useState('');
  const gate = (fn: () => Promise<void>) => { if (!signedIn) { router.push(`/login?next=/community/t/${slug}`); return; } setErr(''); start(fn); };
  const flag = (f: Parameters<typeof setTopicFlags>[1]) => start(async () => { const r = await setTopicFlags(topicId, f); if (r.ok) router.refresh(); else setErr(r.error); });
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button className={`btn btn-sm ${s.voted ? 'border-amber/60 text-amber' : ''}`} aria-pressed={s.voted} disabled={pending} onClick={() => gate(async () => {
        const next = !s.voted; setS((x) => ({ ...x, voted: next, upvotes: x.upvotes + (next ? 1 : -1) }));
        const r = await voteForum({ topic_id: topicId }, next, slug); if (!r.ok) { setErr(r.error); setS((x) => ({ ...x, voted: !next, upvotes: x.upvotes + (next ? -1 : 1) })); }
      })}><ArrowUp size={14} aria-hidden /> {s.upvotes}<span className="sr-only"> upvotes</span></button>
      <button className={`btn btn-sm ${s.bookmarked ? 'border-amber/60 text-amber' : ''}`} aria-pressed={s.bookmarked} disabled={pending} onClick={() => gate(async () => {
        const next = !s.bookmarked; setS((x) => ({ ...x, bookmarked: next })); const r = await setBookmark(topicId, next, slug); if (!r.ok) { setErr(r.error); setS((x) => ({ ...x, bookmarked: !next })); }
      })}><Bookmark size={14} aria-hidden /> {s.bookmarked ? 'Bookmarked' : 'Bookmark'}</button>
      <button className={`btn btn-sm ${s.following ? 'border-amber/60 text-amber' : ''}`} aria-pressed={s.following} disabled={pending} onClick={() => gate(async () => {
        const next = !s.following; setS((x) => ({ ...x, following: next })); const r = await setFollow(topicId, next, slug); if (!r.ok) { setErr(r.error); setS((x) => ({ ...x, following: !next })); }
      })}><Bell size={14} aria-hidden /> {s.following ? 'Following' : 'Follow'}</button>
      {staff && (
        <>
          <button className="btn btn-sm" disabled={pending} onClick={() => flag({ pinned: !pinned })}>{pinned ? 'Unpin' : 'Pin'}</button>
          <button className="btn btn-sm" disabled={pending} onClick={() => flag({ featured: !featured })}>{featured ? 'Unfeature' : 'Feature'}</button>
          <button className="btn btn-sm" disabled={pending} onClick={() => flag({ status: status === 'locked' ? 'open' : 'locked' })}>{status === 'locked' ? 'Unlock' : 'Lock'}</button>
        </>
      )}
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </div>
  );
}
