'use server';
import { authed } from '@/lib/actions/helpers';
import { createClient } from '@/lib/supabase/server';
import { fail, fromDbError, ok, type ActionResult } from '@/lib/actions/result';
import { getSiteSettings } from '@/lib/site';
import { ALLOWED_DOC_MIME, ALLOWED_IMAGE_MIME, MIME_EXT, sniffMime } from '@/lib/storage';

export type UploadKind = 'cover' | 'avatar' | 'step' | 'experiment' | 'source';
const BUCKET: Record<UploadKind, 'recipe-images' | 'avatars' | 'source-files'> = {
  cover: 'recipe-images', step: 'recipe-images', experiment: 'recipe-images', avatar: 'avatars', source: 'source-files',
};

export interface UploadedFile { path: string; bucket: string; mime: string; size: number; name: string }

/**
 * Validated upload. Checks: signed in, rate limit, declared type, size limit, and — importantly — the file's real
 * content (magic bytes) so a renamed file can't slip through. Stored at <user_id>/<random uuid>.<ext>; the user's
 * own file name is never used in the storage path. Storage RLS additionally pins writes to the user's own folder.
 */
export async function uploadFile(formData: FormData): Promise<ActionResult<UploadedFile>> {
  const a = await authed();
  if ('error' in a) return a.error;
  const kind = String(formData.get('kind') ?? '') as UploadKind;
  const file = formData.get('file');
  if (!(kind in BUCKET)) return fail('Unknown upload type.', 'invalid');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a file to upload.', 'upload_failed');

  const settings = await getSiteSettings();
  const wantsDoc = kind === 'source';
  const maxBytes = (file.type === 'application/pdf' ? settings.upload_max_pdf_mb : settings.upload_max_image_mb) * 1024 * 1024;
  if (file.size > maxBytes) return fail(`That file is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`, 'upload_failed');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const real = sniffMime(bytes);
  const allowed: readonly string[] = wantsDoc && settings.uploads_pdf_enabled ? [...ALLOWED_IMAGE_MIME, ...ALLOWED_DOC_MIME] : ALLOWED_IMAGE_MIME;
  if (!real || !allowed.includes(real)) {
    return fail(wantsDoc ? 'Only JPG, PNG, WebP images and PDFs are allowed.' : 'Only JPG, PNG or WebP images are allowed.', 'upload_failed');
  }

  const { data: allowedNow } = await a.supabase.rpc('check_rate_limit', { p_bucket: 'upload', p_max: 20, p_window_seconds: 3600 });
  if (allowedNow === false) return fail('You are uploading too quickly. Please wait a little.', 'rate_limited');

  const bucket = BUCKET[kind];
  const path = `${a.viewer.id}/${crypto.randomUUID()}.${MIME_EXT[real]}`;
  const { error } = await a.supabase.storage.from(bucket).upload(path, bytes, { contentType: real, cacheControl: '31536000', upsert: false });
  if (error) return fromDbError({ message: error.message }, 'The upload failed. Please try again.');
  return ok({ path, bucket, mime: real, size: file.size, name: file.name.slice(0, 120) });
}

/** Short-lived link for a source file. Storage RLS decides who may read it (uploader, staff, or anyone who can view the recipe). */
export async function getSourceFileUrl(path: string): Promise<ActionResult<{ url: string }>> {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(path)) return fail('That file is not available.', 'not_found');
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('source-files').createSignedUrl(path, 300);
  if (error || !data) return fail('That file is not available to you.', 'forbidden');
  return ok({ url: data.signedUrl });
}
