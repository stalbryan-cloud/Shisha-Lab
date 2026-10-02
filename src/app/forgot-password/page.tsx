import type { Metadata } from 'next';
import { ForgotForm } from '@/components/forms/AuthForms';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="container max-w-md py-12">
      <h1 className="font-display text-3xl">Reset your password</h1>
      <p className="mt-1 text-sm text-mute">We’ll email you a link to set a new one.</p>
      <div className="card mt-6 p-6"><ForgotForm /></div>
    </div>
  );
}
