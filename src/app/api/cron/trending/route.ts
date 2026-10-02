import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Called by Vercel Cron (see vercel.json) with `Authorization: Bearer $CRON_SECRET`. Recomputes decayed trending scores. */
export async function GET(req: Request) {
  const secret = requireServerEnv('CRON_SECRET');
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await createAdminClient().rpc('refresh_trending_scores');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
