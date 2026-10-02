'use client';
import { useState, useTransition } from 'react';
import { RatingInput } from '@/components/ui/RatingInput';
import { submitExperiment } from '@/lib/actions/reviews';
import { CHANGE_KINDS } from '@/lib/validators/community';

const KIND_LABEL: Record<string, string> = { ingredient: 'Ingredient', quantity: 'Quantity', aroma: 'Aroma', resting_time: 'Resting time', process: 'Process', other: 'Other' };

/** “I Made This” result log. Separate from the star rating on purpose. */
export function ExperimentForm({ recipeId, versionMajor, versionMinor, signedIn, loginHref, defaultUnit }: { recipeId: string; versionMajor: number; versionMinor: number; signedIn: boolean; loginHref: string; defaultUnit: string }) {
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState<{ kind: string; description: string }[]>([]);
  const [followed, setFollowed] = useState(true);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const today = new Date().toISOString().slice(0, 10);

  if (!signedIn) return <a href={loginHref} className="btn btn-primary">I made this</a>;
  if (!open) return <button id="made" type="button" className="btn btn-primary" onClick={() => setOpen(true)}>I made this</button>;

  function submit(fd: FormData) {
    setMsg(null); setErrors({});
    start(async () => {
      const res = await submitExperiment({
        ...Object.fromEntries(fd.entries()), recipe_id: recipeId, version_major: versionMajor, version_minor: versionMinor,
        followed_exactly: followed, changes: followed ? [] : changes.filter((c) => c.description.trim()),
      });
      if (res.ok) { setMsg({ ok: true, text: res.message ?? 'Result logged. Thanks for contributing!' }); setOpen(false); }
      else { setMsg({ ok: false, text: res.error }); setErrors(res.fieldErrors ?? {}); }
    });
  }
  return (
    <form id="made" action={submit} className="card w-full space-y-4 p-4" aria-label="Log your result">
      <h3 className="font-display text-lg">Log your result <span className="text-sm text-mute">(version {versionMajor}.{versionMinor})</span></h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="made_on">Date made</label><input id="made_on" name="made_on" type="date" max={today} defaultValue={today} required className="field" />{errors.made_on && <p role="alert" className="text-xs text-danger">{errors.made_on[0]}</p>}</div>
        <div><label className="label" htmlFor="batch_size">Batch size ({defaultUnit})</label><input id="batch_size" name="batch_size" inputMode="decimal" className="field" /></div>
        <div><label className="label" htmlFor="would_make_again">Make it again?</label><select id="would_make_again" name="would_make_again" className="field" defaultValue="yes"><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={followed} onChange={(e) => setFollowed(e.target.checked)} /> I followed the recipe exactly</label>
      {!followed && (
        <fieldset className="space-y-2">
          <legend className="label">What did you change?</legend>
          {changes.map((c, i) => (
            <div key={i} className="flex gap-2">
              <select aria-label="Change type" className="field w-36" value={c.kind} onChange={(e) => setChanges(changes.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>{CHANGE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
              <input aria-label="Change description" className="field" maxLength={500} value={c.description} onChange={(e) => setChanges(changes.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="e.g. used 3% less aroma" />
              <button type="button" className="btn btn-sm" onClick={() => setChanges(changes.filter((_, j) => j !== i))} aria-label="Remove change">✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setChanges([...changes, { kind: 'other', description: '' }])} disabled={changes.length >= 12}>+ Add change</button>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><RatingInput name="overall" label="Overall result" required />{errors.overall && <p role="alert" className="text-xs text-danger">{errors.overall[0]}</p>}</div>
        <RatingInput name="flavour_accuracy" label="Flavour accuracy" />
        <RatingInput name="flavour_intensity" label="Flavour intensity" />
        <RatingInput name="sweetness" label="Sweetness" />
        <RatingInput name="strength" label="Strength" />
        <RatingInput name="cloud_output" label="Cloud output" />
        <RatingInput name="heat_tolerance" label="Heat tolerance" />
      </div>
      <div><label className="label" htmlFor="exp-notes">Notes (Markdown supported)</label><textarea id="exp-notes" name="notes" rows={3} maxLength={5000} className="field py-2" /></div>
      <div><label className="label" htmlFor="visibility">Who can see this?</label>
        <select id="visibility" name="visibility" className="field sm:w-60" defaultValue="public"><option value="public">Everyone</option><option value="followers">Followers only</option><option value="private">Only me</option></select>
      </div>
      {msg && !msg.ok && <p role="alert" className="text-sm text-danger">{msg.text}</p>}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Log result'}</button><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}
