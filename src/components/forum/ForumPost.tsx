'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Quote } from 'lucide-react';
import { UserBadge, type BadgeKind } from '@/components/ui/UserBadge';
import { ReportDialog } from '@/components/ui/ReportDialog';
import { deletePost, editPost, voteForum } from '@/lib/actions/forum';
import { setContentState } from '@/lib/actions/moderation';
import { timeAgo } from '@/lib/utils';
import type { PostRow } from '@/lib/types';

export function ForumPost({ post, html, quoteHtml, quoteAuthor, slug, viewerId, staff, isModAuthor, isTopicAuthor, voted, canReply, onQuote }: {
  post: PostRow; html: string; quoteHtml?: string; quoteAuthor?: string; slug: string; viewerId: string | null; staff: boolean;
  isModAuthor: boolean; isTopicAuthor: boolean; voted: boolean; canReply: boolean; onQuote?: (p: PostRow) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.body);
  const [v, setV] = useState({ on: voted, n: post.upvotes });
  const [err, setErr] = useState('');
  const mine = !!viewerId && post.author_id === viewerId;
  const removed = post.moderation !== 'visible';
  const badges: BadgeKind[] = [];
  if (isTopicAuthor) badges.push('creator');
  if (isModAuthor) badges.push('moderator');
  return (
    <li id={`post-${post.id}`} className="card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UserBadge profile={removed ? null : post.author} badges={removed ? [] : badges} size={28} />
        <time className="text-xs text-mute" dateTime={post.created_at}>{timeAgo(post.created_at)}</time>{post.edited_at && !removed && <span className="text-xs text-mute">(edited)</span>}
      </div>
      {removed ? <p className="mt-2 text-sm italic text-mute">This post was removed by a moderator.</p> : editing ? (
        <form className="mt-2 space-y-2" action={() => start(async () => { const r = await editPost(post.id, text, slug); if (r.ok) { setEditing(false); router.refresh(); } else setErr(r.error); })}>
          <textarea className="field py-2" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit post" maxLength={20000} />
          <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={pending}>Save</button><button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
      ) : (
        <>
          {quoteHtml && <blockquote className="mt-2 rounded border-l-2 border-amber/40 bg-raised/50 p-2 text-sm text-mute"><span className="block text-xs">{quoteAuthor} wrote:</span><div dangerouslySetInnerHTML={{ __html: quoteHtml }} /></blockquote>}
          <div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: html }} />
        </>
      )}
      {!removed && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
          <button type="button" aria-pressed={v.on} disabled={!viewerId || pending} className={`inline-flex items-center gap-1 hover:text-amber ${v.on ? 'text-amber' : ''}`}
            onClick={() => start(async () => { const next = !v.on; setV({ on: next, n: v.n + (next ? 1 : -1) }); const r = await voteForum({ post_id: post.id }, next, slug); if (!r.ok) { setV({ on: !next, n: post.upvotes }); setErr(r.error); } })}>
            <ArrowUp size={13} aria-hidden /> {v.n}<span className="sr-only"> upvotes</span></button>
          {canReply && onQuote && <button type="button" className="inline-flex items-center gap-1 hover:text-amber" onClick={() => onQuote(post)}><Quote size={13} aria-hidden /> Quote</button>}
          {mine && <button type="button" className="hover:text-amber" onClick={() => setEditing(true)}>Edit</button>}
          {mine && <button type="button" className="hover:text-danger" disabled={pending} onClick={() => { if (confirm('Delete this post?')) start(async () => { const r = await deletePost(post.id, slug); if (r.ok) router.refresh(); else setErr(r.error); }); }}>Delete</button>}
          {staff && !mine && <button type="button" className="hover:text-danger" disabled={pending} onClick={() => { const reason = prompt('Reason for removal (stored in the audit log):'); if (reason) start(async () => { const r = await setContentState({ type: 'forum_post', id: post.id, state: 'removed', reason }); if (r.ok) router.refresh(); else setErr(r.error); }); }}>Remove (mod)</button>}
          {!mine && <ReportDialog targetType="forum_post" targetId={post.id} signedIn={!!viewerId} compact />}
          {err && <span role="alert" className="text-danger">{err}</span>}
        </div>
      )}
    </li>
  );
}
