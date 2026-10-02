/** Centralised env access. Server-only values are only readable on the server (never prefixed NEXT_PUBLIC_). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? 'SHISHA LAB',
};

export function requireServerEnv(name: 'SUPABASE_SERVICE_ROLE_KEY' | 'CRON_SECRET'): string {
  if (typeof window !== 'undefined') throw new Error(`${name} must never be read in the browser`);
  const v = process.env[name];
  if (!v) throw new Error(`Missing required server environment variable ${name}`);
  return v;
}

export const isSupabaseConfigured = () => Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
