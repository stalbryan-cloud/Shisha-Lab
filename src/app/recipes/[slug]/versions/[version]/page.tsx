import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecipeBySlug, getVersionSnapshot } from '@/lib/queries/recipe-detail';
import { formatDate, formatVersion } from '@/lib/utils';
import { renderMarkdown } from '@/lib/core/markdown';
import { formatAmount } from '@/lib/core/scaler';

type Props = { params: Promise<{ slug: string; version: string }> };

export const metadata: Metadata = { title: 'Recipe version', robots: { index: false } };

/** Read-only view of an immutable historical snapshot, with a field-level diff against the current recipe. */
export default async function VersionPage({ params }: Props) {
  const { slug, version } = await params;
  const m = /^(\d+)\.(\d+)$/.exec(version);
  if (!m) notFound();
  const detail = await getRecipeBySlug(slug);
  if (!detail) notFound();
  const snap = await getVersionSnapshot(detail.recipe.id, Number(m[1]), Number(m[2]));
  if (!snap) notFound();
  const s = snap.snapshot;
  const cur = detail;

  const curAromas = new Map(cur.aromas.map((a) => [a.flavour_name, a]));
  const oldAromas = new Map((s.aromas ?? []).map((a) => [a.flavour_name, a]));
  const diffs: string[] = [];
  for (const [n, a] of oldAromas) {
    const c = curAromas.get(n);
    if (!c) diffs.push(`Aroma “${n}” was in this version but has since been removed.`);
    else if ((a.pct_of_batch ?? a.weight_g) !== (c.pct_of_batch ?? c.weight_g)) diffs.push(`Aroma “${n}” amount changed (then ${a.pct_of_batch != null ? `${a.pct_of_batch}%` : formatAmount(a.weight_g, 'g')}, now ${c.pct_of_batch != null ? `${c.pct_of_batch}%` : formatAmount(c.weight_g, 'g')}).`);
  }
  for (const n of curAromas.keys()) if (!oldAromas.has(n)) diffs.push(`Aroma “${n}” was added after this version.`);
  if ((s.recipe?.recommended_rest_hours ?? null) !== cur.recipe.recommended_rest_hours) diffs.push(`Recommended rest changed (then ${s.recipe?.recommended_rest_hours ?? '—'} h, now ${cur.recipe.recommended_rest_hours ?? '—'} h).`);
  if ((s.steps?.length ?? 0) !== cur.steps.length) diffs.push(`Process steps: ${s.steps?.length ?? 0} then, ${cur.steps.length} now.`);

  return (
    <div className="container max-w-3xl py-8">
      <Link href={`/recipes/${slug}#versions`} className="text-sm text-amber hover:underline">← Back to the current recipe</Link>
      <h1 className="mt-3 font-display text-3xl">{s.recipe?.title ?? cur.recipe.title} <span className="text-mute">{formatVersion(snap.version_major, snap.version_minor)}</span></h1>
      <p className="mt-1 text-sm text-mute">Published {formatDate(snap.created_at)}. This is an archived snapshot and cannot be changed.</p>
      {snap.change_notes && <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm"><strong>Change notes:</strong> {snap.change_notes}</p>}

      <section className="mt-6" aria-labelledby="diff-h">
        <h2 id="diff-h" className="section-title">Differences from the current version</h2>
        {diffs.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{diffs.map((d) => <li key={d}>{d}</li>)}</ul> : <p className="mt-2 text-sm text-mute">No differences in aromas, rest time or step count.</p>}
      </section>

      <section className="mt-8" aria-labelledby="ing-h">
        <h2 id="ing-h" className="section-title mb-2">Ingredients (as of this version)</h2>
        <ul className="card divide-y divide-line">
          {(s.base_ingredients ?? []).map((b) => <li key={b.id ?? b.name} className="flex justify-between px-4 py-2 text-sm"><span>{b.name}</span><span className="text-mute">{b.weight_g != null ? formatAmount(b.weight_g, 'g') : b.volume_ml != null ? formatAmount(b.volume_ml, 'ml') : '—'}</span></li>)}
          {(s.aromas ?? []).map((a) => <li key={a.id ?? a.flavour_name} className="flex justify-between px-4 py-2 text-sm"><span>{a.flavour_name} <span className="chip py-0 text-[10px]">{a.role}</span></span><span className="text-mute">{a.pct_of_batch != null ? `${a.pct_of_batch}%` : a.weight_g != null ? formatAmount(a.weight_g, 'g') : '—'}</span></li>)}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="steps-h">
        <h2 id="steps-h" className="section-title mb-2">Process (as of this version)</h2>
        <ol className="space-y-3">
          {(s.steps ?? []).map((st) => <li key={st.id ?? st.step_number} className="card p-4"><h3 className="font-medium">{st.step_number}. {st.title}</h3><div className="prose-lab mt-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(st.instructions) }} /></li>)}
        </ol>
      </section>
    </div>
  );
}
