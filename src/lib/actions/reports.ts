'use server';
import { authed } from '@/lib/actions/helpers';
import { fail, fromDbError, ok, zodFieldErrors, type ActionResult } from '@/lib/actions/result';
import { reportSchema } from '@/lib/validators/community';

export async function submitReport(input: Record<string, unknown>): Promise<ActionResult> {
  const a = await authed();
  if ('error' in a) return a.error;
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail('Please choose a reason.', 'invalid', zodFieldErrors(parsed.error));
  const { error } = await a.supabase.from('reports').insert({ ...parsed.data, reporter_id: a.viewer.id });
  if (error) {
    if (error.code === '23505') return fail('You have already reported this. Our moderators will take a look.', 'duplicate');
    return fromDbError(error);
  }
  return ok(undefined, 'Thanks — a moderator will review your report.');
}
