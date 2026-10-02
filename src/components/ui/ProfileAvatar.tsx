import Image from 'next/image';
import { publicImageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

export function ProfileAvatar({ profile, size = 32, className }: { profile: { username?: string; display_name?: string | null; avatar_path?: string | null } | null; size?: number; className?: string }) {
  const name = profile?.display_name || profile?.username || '?';
  const url = publicImageUrl(profile?.avatar_path, 'avatars');
  return url ? (
    <Image src={url} alt="" width={size} height={size} className={cn('rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn('inline-flex items-center justify-center rounded-full bg-amber-soft/50 font-display text-ink', className)} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
