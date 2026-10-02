import { defineConfig, devices } from '@playwright/test';

/**
 * E2E needs a running Supabase (local: `supabase start`) with email confirmations DISABLED
 * (see supabase/config.toml) and migrations + seed applied. Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY (server only), plus E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for the admin/moderation specs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run build && npm run start', url: 'http://localhost:3000', timeout: 240_000, reuseExistingServer: true },
});
