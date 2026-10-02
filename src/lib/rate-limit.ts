/**
 * Best-effort in-memory limiter for ANONYMOUS endpoints (signup, login, password reset), keyed by IP.
 * Authenticated writes (comments, posts, ratings, reports, uploads) are limited in the database
 * (see check_rate_limit() and the trg_rate_limit triggers), which holds across serverless instances.
 * For stricter anonymous limits in production, also enable Supabase Auth rate limits / CAPTCHA, or swap this for
 * a shared store (Upstash/Redis) behind the same function signature.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return { ok: true, retryAfterSec: 0 };
}
