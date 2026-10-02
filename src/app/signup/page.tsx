import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { getSiteSettings } from '@/lib/site';
import { SignupForm } from '@/components/forms/AuthForms';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function SignupPage() {
  if (await getViewer()) redirect('/me');
  const s = await getSiteSettings();
  return (
    <div className="container max-w-md py-12">
      <h1 className="font-display text-3xl">Join the lab</h1>
      <p className="mt-1 text-sm text-mute">Free. Adults only. No marketplace, ever.</p>
      <div className="card mt-6 p-6"><SignupForm ageNotice={s.age_notice} /></div>
    </div>
  );
}
