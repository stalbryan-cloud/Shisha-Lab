import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SettingsEditor, type SettingSpec } from '@/components/admin/SettingsEditor';

export const metadata: Metadata = { title: 'Site settings · Admin', robots: { index: false } };

const SPECS: SettingSpec[] = [
  { key: 'site_name', label: 'Site name', kind: 'text' },
  { key: 'announcement', label: 'Announcement banner', kind: 'announcement', hint: 'Shown at the top of every page. Empty text hides it.' },
  { key: 'age_notice', label: 'Age acknowledgement text', kind: 'textarea', hint: 'Shown on first visit and next to the sign-up checkbox.' },
  { key: 'responsible_use_notice', label: 'Responsible-use notice', kind: 'textarea' },
  { key: 'jurisdiction_notice', label: 'Jurisdiction disclaimer', kind: 'textarea' },
  { key: 'health_notice', label: 'Health information notice', kind: 'textarea' },
  { key: 'community_rules', label: 'Community rules (Markdown)', kind: 'textarea' },
  { key: 'forum_delete_window_minutes', label: 'Forum post delete window (minutes)', kind: 'number', hint: 'Authors can delete their own posts only within this window.' },
  { key: 'upload_max_image_mb', label: 'Max image size (MB)', kind: 'number' },
  { key: 'upload_max_pdf_mb', label: 'Max PDF size (MB)', kind: 'number' },
  { key: 'uploads_pdf_enabled', label: 'Allow PDF source uploads', kind: 'boolean' },
];

export default async function AdminSite() {
  const viewer = await requireRole(['moderator', 'admin']);
  if (viewer.role !== 'admin') return <p className="text-mute">Only administrators can change site settings.</p>;
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('key, value');
  const values = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return <div className="space-y-4"><h1 className="font-display text-3xl">Site settings</h1><SettingsEditor specs={SPECS} values={values} /></div>;
}
