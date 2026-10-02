import Link from 'next/link';
import { ProfileAvatar } from './ProfileAvatar';
import type { ProfileLite } from '@/lib/types';
import { cn } from '@/lib/utils';

export type BadgeKind = 'creator' | 'maker' | 'moderator' | 'admin';
const BADGE_TEXT: Record<BadgeKind, string> = { creator: 'Recipe Creator', maker: 'Made This Recipe', moderator: 'Moderator', admin: 'Admin' };

export function UserBadge({ profile, badges = [], size = 28, className }: { profile: ProfileLite | null; badges?: BadgeKind[]; size?: number; className?: string }) {
  if (!profile) return <span className={cn('inline-flex items-center gap-2 text-mute', className)}><ProfileAvatar profile={null} size={size} />[deleted user]</span>;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-2 hover:text-amber">
        <ProfileAvatar profile={profile} size={size} />
        <span className="text-sm font-medium">{profile.display_name || profile.username}</span>
        <span className="text-xs text-mute">@{profile.username}</span>
      </Link>
      {badges.map((b) => <span key={b} className={cn('chip py-0.5 text-[11px]', b === 'moderator' || b === 'admin' ? 'chip-amber' : '')}>{BADGE_TEXT[b]}</span>)}
    </span>
  );
}
