'use client';
import { useState, useTransition } from 'react';
import { RatingInput } from '@/components/ui/RatingInput';
import { submitReview, deleteReview } from '@/lib/actions/reviews';

interface Existing { id: string; maker_status: string; overall: number; flavour: number | null; balance: number | null; ease: number | null; cloud: number | null; heat_tolerance: number | null; body: string | null }

export function ReviewForm({ recipeId, existing, signedIn, isOwner, loginHref }: { recipeId: string; existing: Existing | null; signedIn: boolean; isOwner: boolean; loginHref: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  if (isOwner) return <p className="text-sm text-mute">You can’t rate your own recipe — but others can, and you can reply to their reviews in the comments.</p>;
  if (!signedIn) return <p className="text-sm"><a className="text-amber underline" href={loginHref}>Sign in</a> to rate this recipe.</p>;

  function submit(fd: FormData) {
    setMsg(null); setErrors({});
    start(async () => {
      const res = await submitReview(Object.fromEntries([...fd.entries()].concat([['recipe_id', recipeId]])));
      if (res.ok) setMsg({ ok: true, text: res.message ?? 'Saved.' });
      else { setMsg({ ok: false, text: res.error }); setErrors(res.fieldErrors ?? {}); }
    });
  }
  return (
    <form action={submit} className="card space-y-4 p-4" aria-label="Rate this recipe">
      <h3 className="font-display text-lg">{existing ? 'Your rating' : 'Rate this recipe'}</h3>
      <div>
        <RatingInput name="overall" label="Overall" defaultValue={existing?.overall ?? 0} required />
        {errors.overall && <p role="alert" className="text-xs text-danger">{errors.overall[0]}</p>}
      </div>
      <fieldset>
        <legend className="label">Did you make it?</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {[['made_exactly', 'Made it as written'], ['made_modified', 'Made it with changes'], ['not_made', 'Haven’t made it']].map(([v, l]) => (
            <label key={v} className="inline-flex items-center gap-2"><input type="radio" name="maker_status" value={v} defaultChecked={(existing?.maker_status ?? 'not_made') === v} />{l}</label>
          ))}
        </div>
        <p className="mt-1 text-xs text-mute">Ratings from people who made the recipe are shown separately as “Verified Maker Rating”.</p>
      </fieldset>
      <details>
        <summary className="cursor-pointer text-sm text-amber">Rate in more detail (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RatingInput name="flavour" label="Flavour" defaultValue={existing?.flavour ?? 0} />
          <RatingInput name="balance" label="Balance" defaultValue={existing?.balance ?? 0} />
          <RatingInput name="ease" label="Ease of making" defaultValue={existing?.ease ?? 0} />
          <RatingInput name="cloud" label="Cloud production" defaultValue={existing?.cloud ?? 0} />
          <RatingInput name="heat_tolerance" label="Heat tolerance" defaultValue={existing?.heat_tolerance ?? 0} />
        </div>
      </details>
      <div>
        <label htmlFor="review-body" className="label">Review (optional, Markdown supported)</label>
        <textarea id="review-body" name="body" rows={4} maxLength={5000} defaultValue={existing?.body ?? ''} className="field py-2" />
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-moss' : 'text-sm text-danger'}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : existing ? 'Update rating' : 'Submit rating'}</button>
        {existing && <button type="button" className="btn btn-danger" disabled={pending} onClick={() => { if (confirm('Remove your rating?')) start(async () => { const r = await deleteReview(existing.id); setMsg(r.ok ? { ok: true, text: 'Rating removed.' } : { ok: false, text: r.error }); }); }}>Remove</button>}
      </div>
    </form>
  );
}
