import { describe, expect, it } from 'vitest';
import { slugify, formatVersion, pluralise } from '@/lib/utils';
import { sniffMime } from '@/lib/storage';

describe('utils', () => {
  it('slugifies', () => { expect(slugify('Peach & Mint — Summer!')).toBe('peach-mint-summer'); });
  it('formats versions and plurals', () => { expect(formatVersion(1, 2)).toBe('v1.2'); expect(pluralise(1, 'recipe')).toBe('1 recipe'); expect(pluralise(2, 'recipe')).toBe('2 recipes'); });
});

describe('upload sniffing', () => {
  it('detects real file types from content, not names', () => {
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffMime(new TextEncoder().encode('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffMime(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  });
});
