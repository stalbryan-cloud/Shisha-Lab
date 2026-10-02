'use client';
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile, setAvatar, updateNotificationPrefs, deleteAccount } from '@/lib/actions/profile';
import { changePassword } from '@/lib/actions/auth';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Field, FormMessage } from '@/components/ui/Field';
import { FileUploader } from '@/components/wizard/FileUploader';
import { NOTIFICATION_TYPES } from '@/lib/validators/community';
import type { ActionResult } from '@/lib/actions/result';

const fe = (s: ActionResult | null, k: string) => (s && !s.ok ? s.fieldErrors?.[k] : undefined);

export interface ProfileVM { username: string; display_name: string | null; bio: string | null; location: string | null; website: string | null; experience_level: string | null; show_saved: boolean; show_likes: boolean; show_location: boolean; avatar_path: string | null; social_links: Record<string, string> }

export function ProfileForm({ p }: { p: ProfileVM }) {
  const [state, action] = useActionState(updateProfile, null);
  const router = useRouter();
  const [avatar, setAv] = useState(p.avatar_path);
  const [msg, setMsg] = useState('');
  return (
    <div className="space-y-6">
      <FileUploader kind="avatar" bucket="avatars" label="Avatar" accept="image/jpeg,image/png,image/webp" value={avatar} hint="JPG, PNG or WebP. Shown next to your name."
        onUploaded={async (f) => { const r = await setAvatar(f.path); if (r.ok) { setAv(f.path); setMsg('Avatar updated.'); router.refresh(); } else setMsg(r.error); }}
        onClear={async () => { const r = await setAvatar(null); if (r.ok) { setAv(null); router.refresh(); } }} />
      {msg && <p role="status" className="text-sm text-mute">{msg}</p>}
      <form action={action} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" name="username" error={fe(state, 'username')}><input id="username" name="username" defaultValue={p.username} className="field" required /></Field>
          <Field label="Display name" name="display_name" error={fe(state, 'display_name')}><input id="display_name" name="display_name" defaultValue={p.display_name ?? ''} maxLength={60} className="field" /></Field>
        </div>
        <Field label="Bio" name="bio" error={fe(state, 'bio')} hint="Up to 500 characters."><textarea id="bio" name="bio" defaultValue={p.bio ?? ''} maxLength={500} rows={3} className="field py-2" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" name="location" error={fe(state, 'location')}><input id="location" name="location" defaultValue={p.location ?? ''} maxLength={80} className="field" /></Field>
          <Field label="Website" name="website" error={fe(state, 'website')}><input id="website" name="website" type="url" defaultValue={p.website ?? ''} className="field" placeholder="https://…" /></Field>
          <Field label="Experience level" name="experience_level"><select id="experience_level" name="experience_level" defaultValue={p.experience_level ?? ''} className="field"><option value="">Not shown</option>{['beginner', 'intermediate', 'advanced', 'expert'].map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}</select></Field>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="label">Links (shown on your profile)</legend>
          {(['instagram', 'youtube', 'discord', 'reddit'] as const).map((k) => <div key={k}><label className="label capitalize" htmlFor={`social_${k}`}>{k}</label><input id={`social_${k}`} name={`social_${k}`} defaultValue={p.social_links?.[k] ?? ''} maxLength={100} className="field" /></div>)}
        </fieldset>
        <fieldset className="space-y-2 text-sm"><legend className="label">Privacy</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="show_location" defaultChecked={p.show_location} /> Show my location on my profile</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="show_saved" defaultChecked={p.show_saved} /> Show my saved recipes on my profile</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="show_likes" defaultChecked={p.show_likes} /> Show recipes I’ve liked on my profile</label>
        </fieldset>
        <FormMessage state={state} />
        <SubmitButton>Save profile</SubmitButton>
      </form>
    </div>
  );
}

export function NotificationPrefsForm({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, setState] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3" action={(fd) => start(async () => {
      const next = Object.fromEntries(NOTIFICATION_TYPES.map(([k]) => [k, fd.get(k) === 'on']));
      const r = await updateNotificationPrefs(next);
      setState(r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error });
    })}>
      {NOTIFICATION_TYPES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={k} defaultChecked={prefs[k] !== false} /> {l}</label>)}
      <FormMessage state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save preferences'}</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="max-w-sm space-y-4" noValidate>
      <Field label="New password" name="password" error={fe(state, 'password')}><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} className="field" /></Field>
      <Field label="Confirm new password" name="confirm" error={fe(state, 'confirm')}><input id="confirm" name="confirm" type="password" autoComplete="new-password" className="field" /></Field>
      <FormMessage state={state} /><SubmitButton>Change password</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="max-w-md space-y-3" noValidate>
      <p className="text-sm text-mute">Your login and profile are removed. Recipes, comments and posts you made stay in the community, shown as “[deleted user]”, so threads and version history still make sense. This cannot be undone.</p>
      <Field label={`Type “${username}” to confirm`} name="confirm" error={fe(state, 'confirm')}><input id="confirm" name="confirm" className="field" autoComplete="off" /></Field>
      <FormMessage state={state} />
      <SubmitButton className="btn-danger bg-transparent text-danger">Delete my account</SubmitButton>
    </form>
  );
}
