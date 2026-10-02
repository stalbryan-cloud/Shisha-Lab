import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, requireServerEnv } from '@/lib/env';

/**
 * Service-role client. BYPASSES RLS. Use ONLY in:
 *   - /api/cron/*      (trending refresh)
 *   - deleteAccount    (removing the auth user after the profile was anonymised)
 * Never import from a Client Component or pass its results through without filtering.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
