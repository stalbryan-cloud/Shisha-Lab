import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** URL-driven pagination. `hrefFor(page)` must return the full href preserving other query params. */
export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const window = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...window].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? <Link className="btn btn-sm" href={hrefFor(page - 1)} rel="prev"><ChevronLeft size={14} /> Prev</Link> : <span className="btn btn-sm opacity-40"><ChevronLeft size={14} /> Prev</span>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-mute" aria-hidden>…</span>}
          <Link href={hrefFor(n)} aria-current={n === page ? 'page' : undefined} className={n === page ? 'btn btn-sm btn-primary' : 'btn btn-sm'}>{n}</Link>
        </span>
      ))}
      {page < pages ? <Link className="btn btn-sm" href={hrefFor(page + 1)} rel="next">Next <ChevronRight size={14} /></Link> : <span className="btn btn-sm opacity-40">Next <ChevronRight size={14} /></span>}
    </nav>
  );
}
