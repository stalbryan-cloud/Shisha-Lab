'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ForumPost } from './ForumPost';
import { replyToTopic } from '@/lib/actions/forum';
import type { PostRow } from '@/lib/types';

export function TopicThread({ topicId, slug, locked, posts, html, viewerId, staff, moderatorIds, topicAuthorId, votedPostIds }: {
  topicId: string; slug: string; locked: boolean; posts: PostRow[]; html: Record<string, string>; viewerId: string | null; staff: boolean;
  moderatorIds: string[]; topicAuthorId: string | null; votedPostIds: string[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [quote, setQuote] = useState<PostRow | null>(null);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const byId = new Map(posts.map((p) => [p.id, p]));
  const canReply = !!viewerId && !locked;

  return (
    <div className="space-y-4">
      <h2 className="section-title">{posts.length} {posts.length === 1 ? 'reply' : 'replies'}</h2>
      <ol className="space-y-3">
        {posts.map((p) => {
          const q = p.quoted_post_id ? byId.get(p.quoted_post_id) : undefined;
          return <ForumPost key={p.id} post={p} html={html[p.id] ?? ''} quoteHtml={q && q.moderation === 'visible' ? html[`q:${q.id}`] : undefined} quoteAuthor={q?.author ? `@${q.author.username}` : undefined}
            slug={slug} viewerId={viewerId} staff={staff} isModAuthor={!!p.author_id && moderatorIds.includes(p.author_id)} isTopicAuthor={!!p.author_id && p.author_id === topicAuthorId}
            voted={votedPostIds.includes(p.id)} canReply={canReply} onQuote={(x) => { setQuote(x); box.current?.focus(); box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }} />;
        })}
      </ol>
      {locked ? <p className="rounded-md border border-line bg-surface p-3 text-sm text-mute">This topic is locked. No new replies can be posted.</p>
        : !viewerId ? <p className="text-sm"><Link className="text-amber underline" href={`/login?next=/community/t/${slug}`}>Sign in</Link> to reply.</p> : (
        <form id="reply" className="card space-y-3 p-4" action={() => start(async () => {
          setErr('');
          const r = await replyToTopic({ topic_id: topicId, body, quoted_post_id: quote?.id ?? null, slug });
          if (r.ok) { setBody(''); setQuote(null); router.refresh(); } else setErr(r.error);
        })}>
          <label htmlFor="reply-body" className="label">Your reply (Markdown supported, @mention members)</label>
          {quote && <p className="flex items-center justify-between rounded bg-raised px-3 py-1.5 text-xs text-mute">Quoting @{quote.author?.username ?? 'deleted user'}<button type="button" className="text-amber" onClick={() => setQuote(null)}>Remove quote</button></p>}
          <textarea id="reply-body" ref={box} rows={5} maxLength={20000} className="field py-2" value={body} onChange={(e) => setBody(e.target.value)} />
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <button className="btn btn-primary" disabled={pending || !body.trim()}>{pending ? 'Posting…' : 'Post reply'}</button>
        </form>
      )}
    </div>
  );
}
