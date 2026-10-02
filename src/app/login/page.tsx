import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { safeNext } from '@/lib/actions/helpers';
import { LoginForm } from '@/components/forms/AuthForms';

export const metadata: Metadata = { title: 'Log in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/');
  if (await getViewer()) redirect(next);
  return (
    <div className="container max-w-md py-12">
      <h1 className="font-display text-3xl">Welcome back</h1>
      <div className="card mt-6 p-6"><LoginForm next={next} notice={sp.error === 'link' ? 'That link has expired or was already used. Please log in or request a new one.' : sp.next ? 'Please log in to continue.' : undefined} /></div>
    </div>
  );
}
