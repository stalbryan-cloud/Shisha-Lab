import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquare, Plus } from 'lucide-react';
import { getCategories, listTopics, TOPIC_SORTS, TOPIC_SORT_LABELS, TOPIC_RANGES, TOPIC_PAGE_SIZE } from '@/lib/queries/forum';
import { ForumTopicRow } from '@/components/forum/ForumTopicRow';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Community', description: 'Discuss technique, ingredients, troubleshooting and results with other recipe makers.' };
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const RANGE_LABEL: Record<string, string> = { day: 'Today', week: 'This week', month: 'This month', year: 'This year', all: 'All time' };

export default async function CommunityPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === one(sp.category));
  const sort = one(sp.sort) || 'latest', range = one(sp.range) || 'all', q = one(sp.q), tag = one(sp.tag);
  const page = Math.max(1, parseInt(one(sp.page)) || 1);
  const result = await listTopics({ category: cat?.id, sort, range, q, tag, page });
  const href = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { category: cat?.slug ?? '', sort, range, q, tag, page: String(page) };
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v !== null && v !== '' && !(k === 'sort' && v === 'latest') && !(k === 'range' && v === 'all') && !(k === 'page' && String(v) === '1')) p.set(k, String(v));
    const s = p.toString(); return `/community${s ? `?${s}` : ''}`;
  };
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Community</h1><p className="text-mute">Technique, troubleshooting, results and ideas. No selling — see the <Link className="text-amber underline" href="/rules">rules</Link>.</p></div>
        <Link href="/community/new" className="btn btn-primary"><Plus size={16} aria-hidden /> New topic</Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Categories" className="space-y-4">
          <nav className="card p-2">
            <Link href={href({ category: null, page: 1 })} aria-current={!cat ? 'page' : undefined} className={`block rounded px-3 py-2 text-sm ${!cat ? 'bg-raised text-amber' : 'hover:bg-raised'}`}>All topics</Link>
            {cats.map((c) => <Link key={c.id} href={href({ category: c.slug, page: 1 })} aria-current={cat?.id === c.id ? 'page' : undefined} className={`block rounded px-3 py-2 text-sm ${cat?.id === c.id ? 'bg-raised text-amber' : 'hover:bg-raised'}`}>{c.name}</Link>)}
          </nav>
          {cat?.description && <p className="text-xs text-mute">{cat.description}</p>}
        </aside>
        <section aria-label="Topics" className="space-y-4">
          <form action="/community" className="flex flex-wrap items-end gap-2" role="search">
            {cat && <input type="hidden" name="category" value={cat.slug} />}
            <div className="min-w-48 flex-1"><label htmlFor="fq" className="label">Search the forum</label><input id="fq" name="q" defaultValue={q} className="field" placeholder="Topics, replies, tags…" /></div>
            <div><label htmlFor="fs" className="label">Sort</label><select id="fs" name="sort" defaultValue={sort} className="field">{TOPIC_SORTS.map((s) => <option key={s} value={s}>{TOPIC_SORT_LABELS[s]}</option>)}</select></div>
            <div><label htmlFor="fr" className="label">Period</label><select id="fr" name="range" defaultValue={range} className="field">{TOPIC_RANGES.map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}</select></div>
            <button className="btn">Apply</button>
          </form>
          {tag && <p className="text-sm">Tag: <span className="chip chip-amber">#{tag}</span> <Link className="ml-2 text-xs text-mute underline" href={href({ tag: null, page: 1 })}>clear</Link></p>}
          {result.items.length === 0 ? <EmptyState icon={<MessageSquare size={32} />} title="No topics here yet" body={q ? 'Nothing matched your search. Try fewer words or another category.' : 'Be the first to start a conversation.'} action={{ href: '/community/new', label: 'Start a topic' }} />
            : <ul className="space-y-2">{result.items.map((t) => <ForumTopicRow key={t.id} topic={t} />)}</ul>}
          <Pagination page={page} pageSize={TOPIC_PAGE_SIZE} total={result.total} hrefFor={(n) => href({ page: n })} />
        </section>
      </div>
    </div>
  );
}
