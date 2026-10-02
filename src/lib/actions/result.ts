/** Uniform server-action result so the UI can show useful errors without leaking database internals. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; code?: ErrorCode };

export type ErrorCode =
  | 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'duplicate' | 'rate_limited'
  | 'suspended' | 'upload_failed' | 'unknown';

export const ok = <T = undefined>(data?: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
export const fail = (error: string, code: ErrorCode = 'unknown', fieldErrors?: Record<string, string[]>): ActionResult<never> =>
  ({ ok: false, error, code, fieldErrors });

interface PgLikeError { code?: string; message?: string; details?: string }

/** Map Postgres/PostgREST errors to friendly messages. Raw messages are never shown to users. */
export function fromDbError(err: PgLikeError | null | undefined, fallback = 'Something went wrong. Please try again.'): ActionResult<never> {
  const msg = err?.message ?? '';
  const code = err?.code ?? '';
  if (code === '23505') return fail('That already exists.', 'duplicate');
  if (code === '42501' || /row-level security|permission denied|forbidden/i.test(msg)) {
    return fail('You do not have permission to do that. If you were suspended, you can read your notice in Notifications.', 'forbidden');
  }
  if (/rate_limited/.test(msg)) return fail('You are doing that too quickly. Please wait a few minutes and try again.', 'rate_limited');
  if (/max_depth/.test(msg)) return fail('This thread is too deep — continue the discussion in the Community forum instead.', 'invalid');
  if (/invalid_recipe:/.test(msg)) return fail(msg.split('invalid_recipe:')[1].trim().replace(/^./, (c) => c.toUpperCase()) + '.', 'invalid');
  if (/account suspended/.test(msg)) return fail('Your account is suspended.', 'suspended');
  if (code === 'PGRST116' || /not found/i.test(msg)) return fail('That could not be found.', 'not_found');
  if (code === '23514' || code === '22P02' || code === '23502') return fail('Some of the information is not valid. Please check the form.', 'invalid');
  return fail(fallback, 'unknown');
}

/** Field errors keyed by dotted path ("aromas.2.pct_of_batch"); top-level keys ("email") are unchanged. The first message per key wins. */
export function zodFieldErrors(error: { issues: { path: (string | number)[]; message: string }[] }): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
