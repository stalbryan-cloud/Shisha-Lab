'use client';
import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { uploadFile, type UploadKind, type UploadedFile } from '@/lib/actions/uploads';
import { publicImageUrl } from '@/lib/storage';

/** Uploads through a server action (which validates real file content). Shows a preview for public images. */
export function FileUploader({ kind, label, accept, value, onUploaded, onClear, hint, bucket = 'recipe-images' }: {
  kind: UploadKind; label: string; accept: string; value?: string | null; onUploaded: (f: UploadedFile) => void; onClear?: () => void; hint?: string; bucket?: 'recipe-images' | 'avatars';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const preview = kind !== 'source' ? publicImageUrl(value, bucket) : null;
  function pick(file?: File) {
    if (!file) return;
    setErr('');
    const fd = new FormData(); fd.set('kind', kind); fd.set('file', file);
    start(async () => { const r = await uploadFile(fd); if (r.ok && r.data) onUploaded(r.data); else if (!r.ok) setErr(r.error); if (input.current) input.current.value = ''; });
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {preview && <div className="relative h-20 w-32 overflow-hidden rounded-md border border-line"><Image src={preview} alt="" fill sizes="128px" className="object-cover" /></div>}
        <input ref={input} type="file" accept={accept} className="sr-only" id={`up-${kind}-${label}`} onChange={(e) => pick(e.target.files?.[0])} />
        <label htmlFor={`up-${kind}-${label}`} className={`btn btn-sm cursor-pointer ${pending ? 'pointer-events-none opacity-60' : ''}`}><Upload size={14} aria-hidden /> {pending ? 'Uploading…' : value ? 'Replace' : 'Choose file'}</label>
        {value && onClear && <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}><X size={14} aria-hidden /> Remove</button>}
        {value && !preview && <span className="text-xs text-mute">File attached</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
