import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono, Caveat } from 'next/font/google';
import './globals.css';
import { getSiteSettings } from '@/lib/site';
import { publicEnv } from '@/lib/env';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AgeNotice } from '@/components/layout/AgeNotice';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: `${publicEnv.siteName} — homemade shisha recipe lab`, template: `%s · ${publicEnv.siteName}` },
  description: 'A community notebook for documenting, testing, rating and discussing homemade shisha tobacco recipes. Not a shop.',
  openGraph: { type: 'website', siteName: publicEnv.siteName },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { themeColor: '#eff2f0', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSiteSettings();
  const banner = s.announcement && s.announcement.text ? s.announcement : null;
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${hand.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-2 focus:text-surface">Skip to content</a>
        {banner && <div role="status" className={`px-4 py-2 text-center text-sm ${banner.tone === 'warning' ? 'bg-ember/20 text-ember' : 'bg-amber/10 text-amber'}`}>{banner.text}</div>}
        <SiteHeader siteName={s.site_name} />
        <main id="main">{children}</main>
        <SiteFooter s={s} />
        <AgeNotice ageNotice={s.age_notice} responsible={s.responsible_use_notice} jurisdiction={s.jurisdiction_notice} health={s.health_notice} rulesHref="/rules" />
      </body>
    </html>
  );
}
