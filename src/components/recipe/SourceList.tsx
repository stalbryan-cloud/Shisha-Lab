import { ExternalLink, FileText } from 'lucide-react';
import { safeUrl } from '@/lib/core/markdown';
import { SourceFileLink } from './SourceFileLink';
import type { SourceRow } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  website: 'Website', forum: 'Forum thread', video: 'Video', book: 'Book', manufacturer_doc: 'Manufacturer document',
  personal_experiment: 'Personal experiment', photo: 'Photo', pdf: 'PDF', ingredient_label: 'Ingredient label', other: 'Other',
};

/** External links open with rel=noopener nofollow ugc. Uploaded files are served via short-lived signed URLs. */
export function SourceList({ sources }: { sources: SourceRow[] }) {
  if (!sources.length) return <p className="text-sm text-mute">The creator did not list any sources.</p>;
  return (
    <ul className="space-y-3">
      {sources.map((s) => {
        const href = s.url ? safeUrl(s.url) : null;
        return (
          <li key={s.id} className="card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">{TYPE_LABEL[s.source_type] ?? s.source_type}</span>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-1 font-medium text-amber hover:underline">
                  {s.title} <ExternalLink size={13} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : s.file_path ? (
                <span className="inline-flex items-center gap-1 font-medium"><FileText size={14} aria-hidden /> {s.title}</span>
              ) : <span className="font-medium">{s.title}</span>}
              {s.file_path && <SourceFileLink path={s.file_path} />}
            </div>
            {s.description && <p className="mt-1.5 text-sm text-mute">{s.description}</p>}
            {href && <p className="mt-1 break-all text-xs text-mute">{new URL(href).hostname}</p>}
          </li>
        );
      })}
    </ul>
  );
}
