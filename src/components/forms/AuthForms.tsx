'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { login, signup, requestPasswordReset } from '@/lib/actions/auth';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Field, FormMessage } from '@/components/ui/Field';
import type { ActionResult } from '@/lib/actions/result';

const fe = (s: ActionResult | null, k: string) => (s && !s.ok ? s.fieldErrors?.[k] : undefined);

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && <p role="status" className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber">{notice}</p>}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" error={fe(state, 'email')}><input id="email" name="email" type="email" autoComplete="email" required className="field" aria-describedby="email-err" /></Field>
      <Field label="Password" name="password" error={fe(state, 'password')}><input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Signing in…" className="w-full">Log in</SubmitButton>
      <p className="flex justify-between text-sm text-mute"><Link className="text-amber hover:underline" href="/forgot-password">Forgot password?</Link><span>No account? <Link className="text-amber hover:underline" href="/signup">Sign up</Link></span></p>
    </form>
  );
}

export function SignupForm({ ageNotice }: { ageNotice: string }) {
  const [state, action] = useActionState(signup, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Username" name="username" error={fe(state, 'username')} hint="3–24 characters: lowercase letters, numbers, underscore. Public."><input id="username" name="username" autoComplete="username" required pattern="[a-z0-9_]{3,24}" className="field lowercase" /></Field>
      <Field label="Email" name="email" error={fe(state, 'email')} hint="Never shown publicly."><input id="email" name="email" type="email" autoComplete="email" required className="field" /></Field>
      <Field label="Password" name="password" error={fe(state, 'password')} hint="At least 10 characters."><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="field" /></Field>
      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" name="age_ack" required className="mt-1" /><span>{ageNotice}</span></label>
        {fe(state, 'age_ack') && <p role="alert" className="text-xs text-danger">{fe(state, 'age_ack')![0]}</p>}
        <label className="flex items-start gap-2"><input type="checkbox" name="rules_ack" required className="mt-1" /><span>I have read and accept the <Link target="_blank" className="text-amber underline" href="/rules">community rules</Link>, including no selling or trading.</span></label>
        {fe(state, 'rules_ack') && <p role="alert" className="text-xs text-danger">{fe(state, 'rules_ack')![0]}</p>}
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating account…" className="w-full">Create account</SubmitButton>
      <p className="text-sm text-mute">Already registered? <Link className="text-amber hover:underline" href="/login">Log in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" name="email" error={fe(state, 'email')}><input id="email" name="email" type="email" autoComplete="email" required className="field" /></Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Sending…" className="w-full">Send reset link</SubmitButton>
    </form>
  );
}
