'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTopic } from '@/lib/actions/forum';

export function NewTopicForm({ categories, defaultCategory, recipe }: { categories: { id: string; name: string }[]; defaultCategory?: string; recipe: { id: string; title: string } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [fe, setFe] = useState<Record<string, string[]>>({});
  return (
    <form className="mt-6 space-y-4" action={(fd) => start(async () => {
      setErr(''); setFe({});
      const tags = String(fd.get('tags') ?? '').split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean).slice(0, 5);
      const r = await createTopic({ category_id: fd.get('category_id'), title: fd.get('title'), body: fd.get('body'), tags, recipe_id: recipe?.id ?? null });
      if (r.ok && r.data) router.push(`/community/t/${r.data.slug}`); else if (!r.ok) { setErr(r.error); setFe(r.fieldErrors ?? {}); }
    })}>
      {recipe && <p className="rounded-md border border-line bg-surface p-3 text-sm">Linked recipe: <strong>{recipe.title}</strong></p>}
      <div><label className="label" htmlFor="category_id">Category</label>
        <select id="category_id" name="category_id" required defaultValue={defaultCategory ?? ''} className="field"><option value="" disabled>Choose a category…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {fe.category_id && <p role="alert" className="mt-1 text-xs text-danger">{fe.category_id[0]}</p>}</div>
      <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required minLength={5} maxLength={160} className="field" />{fe.title && <p role="alert" className="mt-1 text-xs text-danger">{fe.title[0]}</p>}</div>
      <div><label className="label" htmlFor="body">Post (Markdown supported)</label><textarea id="body" name="body" required rows={10} maxLength={20000} className="field py-2" />{fe.body && <p role="alert" className="mt-1 text-xs text-danger">{fe.body[0]}</p>}</div>
      <div><label className="label" htmlFor="tags">Tags (comma separated, up to 5)</label><input id="tags" name="tags" className="field" placeholder="resting, glycerin, troubleshooting" /></div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Posting…' : 'Post topic'}</button>
    </form>
  );
}
