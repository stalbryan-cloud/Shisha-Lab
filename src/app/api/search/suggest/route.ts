import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

/** Search-as-you-type suggestions: flavours (typo tolerant via pg_trgm + synonyms), aromas, recipes, tags. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const ip = (req.headers.get('x-forwarded-for') ?? 'anon').split(',')[0].trim();
  if (!rateLimit(`suggest:${ip}`, 120, 60_000).ok) return NextResponse.json({ items: [] }, { status: 429 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_autocomplete', { p_q: q, p_per_group: 4 });
  if (error) return NextResponse.json({ items: [] }, { status: 200 });
  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
