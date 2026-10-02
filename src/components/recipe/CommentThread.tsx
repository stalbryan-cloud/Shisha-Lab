'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUp, CornerDownRight } from 'lucide-react';
import { UserBadge, type BadgeKind } from '@/components/ui/UserBadge';
import { ReportDialog } from '@/components/ui/ReportDialog';
import { postComment, editComment, deleteComment, voteComment, continueInCommunity } from '@/lib/actions/comments';
import { useRouter } from 'next/navigation';
import { timeAgo } from '@/lib/utils';
import type { CommentRow } from '@/lib/types';

export interface ThreadCtx {
  recipeId: string; slug: string; creatorId: string | null; viewerId: string | null; viewerIsStaff: boolean;
  makerIds: string[]; moderatorIds: string[]; votedIds: string[]; maxDepth: number;
  /** pre-rendered, sanitised HTML keyed by comment id (rendered on the server by renderMarkdown) */
  html: Record<string, string>;
}

export function CommentComposer({ ctx, parentId, onDone, autoFocus, placeholder }: { ctx: ThreadCtx; parentId?: string | null; onDone?: () => void; autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [body, setBody] = useState('');
  if (!ctx.viewerId) return <p className="text-sm text-mute"><Link className="text-amber underline" href={`/login?next=/recipes/${ctx.slug}`}>Sign in</Link> to join the discussion.</p>;
  return (
    <form className="space-y-2" action={() => start(async () => {
      setErr('');
      const res = await postComment({ recipe_id: ctx.recipeId, parent_id: parentId ?? null, body, slug: ctx.slug });
      if (res.ok) { setBody(''); onDone?.(); router.refresh(); } else setErr(res.error);
    })}>
      <label className="sr-only" htmlFor={`c-${parentId ?? 'root'}`}>Comment</label>
      <textarea id={`c-${parentId ?? 'root'}`} className="field py-2" rows={parentId ? 2 : 3} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} autoFocus={autoFocus}
        placeholder={placeholder ?? 'Add a comment… Markdown is supported. Mention people with @username.'} />
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={pending || !body.trim()}>{pending ? 'Posting…' : 'Post comment'}</button>{onDone && <button type="button" className="btn btn-sm" onClick={onDone}>Cancel</button>}</div>
    </form>
  );
}

function Comment({ c, ctx, children }: { c: CommentRow; ctx: ThreadCtx; children: React.ReactNode }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [votes, setVotes] = useState({ n: c.upvotes, on: ctx.votedIds.includes(c.id) });
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const mine = ctx.viewerId && c.user_id === ctx.viewerId;
  const removed = c.deleted_at || c.moderation !== 'visible';
  const badges: BadgeKind[] = [];
  if (c.user_id && c.user_id === ctx.creatorId) badges.push('creator');
  if (c.user_id && ctx.makerIds.includes(c.user_id)) badges.push('maker');
  if (c.user_id && ctx.moderatorIds.includes(c.user_id)) badges.push('moderator');

  return (
    <li id={`comment-${c.id}`} className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
        <UserBadge profile={removed ? null : c.author} badges={removed ? [] : badges} size={24} />
        <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>{c.edited_at && !removed && <span>(edited)</span>}
      </div>
      {removed ? (
        <p className="mt-1 text-sm italic text-mute">{c.moderation !== 'visible' ? 'Removed by a moderator.' : 'This comment was deleted.'}</p>
      ) : editing ? (
        <form className="mt-2 space-y-2" action={() => start(async () => { const r = await editComment(c.id, text, ctx.slug); if (r.ok) { setEditing(false); router.refresh(); } else setErr(r.error); })}>
          <textarea className="field py-2" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} aria-label="Edit comment" />
          {err && <p role="alert" className="text-xs text-danger">{err}</p>}
          <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={pending}>Save</button><button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
      ) : (
        <div className="prose-lab mt-1" dangerouslySetInnerHTML={{ __html: ctx.html[c.id] ?? '' }} />
      )}
      {!removed && !editing && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
          <button type="button" aria-pressed={votes.on} disabled={!ctx.viewerId || pending} className={`inline-flex items-center gap-1 hover:text-amber ${votes.on ? 'text-amber' : ''}`}
            onClick={() => start(async () => { const next = !votes.on; setVotes({ n: votes.n + (next ? 1 : -1), on: next }); const r = await voteComment(c.id, next, ctx.slug); if (!r.ok) setVotes({ n: c.upvotes, on: !next }); })}>
            <ArrowUp size={13} aria-hidden /> {votes.n} <span className="sr-only">upvotes</span>
          </button>
          {ctx.viewerId && c.depth < ctx.maxDepth && <button type="button" className="inline-flex items-center gap-1 hover:text-amber" onClick={() => setReplying((v) => !v)}><CornerDownRight size={13} aria-hidden /> Reply</button>}
          {c.depth >= ctx.maxDepth && ctx.viewerId && (
            <button type="button" className="hover:text-amber" disabled={pending} onClick={() => start(async () => { const r = await continueInCommunity(c.id); if (r.ok && r.data) router.push(`/community/t/${r.data.topicSlug}`); else if (!r.ok) setErr(r.error); })}>Continue in Community →</button>
          )}
          {mine && <button type="button" className="hover:text-amber" onClick={() => setEditing(true)}>Edit</button>}
          {(mine || ctx.viewerIsStaff) && <button type="button" className="hover:text-danger" disabled={pending} onClick={() => { if (confirm('Delete this comment?')) start(async () => { const r = await deleteComment(c.id, ctx.slug); if (r.ok) router.refresh(); else setErr(r.error); }); }}>Delete</button>}
          {!mine && <ReportDialog targetType="comment" targetId={c.id} signedIn={!!ctx.viewerId} compact />}
          {err && <span role="alert" className="text-danger">{err}</span>}
        </div>
      )}
      {replying && <div className="mt-2"><CommentComposer ctx={ctx} parentId={c.id} autoFocus onDone={() => setReplying(false)} placeholder="Write a reply…" /></div>}
      {children}
    </li>
  );
}

export function CommentThread({ comments, ctx }: { comments: CommentRow[]; ctx: ThreadCtx }) {
  const byParent = new Map<string | null, CommentRow[]>();
  for (const c of comments) { const k = c.parent_id; byParent.set(k, [...(byParent.get(k) ?? []), c]); }
  const render = (parent: string | null): React.ReactNode => {
    const list = byParent.get(parent);
    if (!list?.length) return null;
    return (
      <ul className={parent ? 'ml-3 border-l border-line pl-3 sm:ml-5 sm:pl-4' : 'divide-y divide-line/60'}>
        {list.map((c) => <Comment key={c.id} c={c} ctx={ctx}>{render(c.id)}</Comment>)}
      </ul>
    );
  };
  return (
    <section aria-labelledby="comments-h" className="space-y-4">
      <h2 id="comments-h" className="section-title">Discussion <span className="text-base text-mute">({comments.filter((c) => !c.deleted_at && c.moderation === 'visible').length})</span></h2>
      <CommentComposer ctx={ctx} />
      {comments.length === 0 ? <p className="text-sm text-mute">No comments yet. Start the conversation.</p> : render(null)}
    </section>
  );
}
