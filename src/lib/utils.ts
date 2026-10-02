import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function slugify(input: string, max = 60): string {
  return input
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'recipe';
}
/** Short random suffix so slugs stay unique without a round-trip. */
export const randomSuffix = (len = 5) =>
  Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

export function timeAgo(date: string | Date, now = new Date()): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / 1000));
  const units: [number, string][] = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [secs, label] of units) if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  return 'just now';
}
export const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

export const formatVersion = (major: number, minor: number) => `v${major}.${minor}`;
export function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—';
  if (h < 24) return `${h} h`;
  const d = h / 24;
  return Number.isInteger(d) ? `${d} d` : `${h} h`;
}
export const pluralise = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
