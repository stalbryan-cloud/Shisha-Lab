import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

export interface SiteSettings {
  site_name: string;
  announcement: { text: string; tone?: 'info' | 'warning' } | null;
  age_notice: string;
  responsible_use_notice: string;
  jurisdiction_notice: string;
  health_notice: string;
  community_rules: string;
  forum_delete_window_minutes: number;
  upload_max_image_mb: number;
  upload_max_pdf_mb: number;
  uploads_pdf_enabled: boolean;
}

const DEFAULTS: SiteSettings = {
  site_name: publicEnv.siteName,
  announcement: null,
  age_notice: 'This community is for adults only.',
  responsible_use_notice: 'Tobacco products are harmful and addictive.',
  jurisdiction_notice: 'Laws differ by region; follow the laws that apply to you.',
  health_notice: 'Recipes are user-generated experiences, not medical or safety guarantees.',
  community_rules: 'Be respectful. No selling or marketplace activity.',
  forum_delete_window_minutes: 30,
  upload_max_image_mb: 5,
  upload_max_pdf_mb: 10,
  uploads_pdf_enabled: true,
};

/** Runtime-configurable settings from the site_settings table (admin editable), merged over safe defaults. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('site_settings').select('key, value');
    const merged: Record<string, unknown> = { ...DEFAULTS };
    for (const row of data ?? []) merged[row.key] = row.value;
    return merged as unknown as SiteSettings;
  } catch {
    return DEFAULTS;
  }
});
