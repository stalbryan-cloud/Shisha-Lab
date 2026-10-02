import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = { title: 'About & notices' };

export default async function AboutPage() {
  const s = await getSiteSettings();
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <h1 className="font-display text-3xl">About {s.site_name}</h1>
      <p>{s.site_name} is a community notebook for people who experiment with homemade shisha tobacco. Members document recipes, log what happened when they made them, rate and review results, and discuss technique.</p>
      <h2 className="section-title">What this site is not</h2>
      <p>It is not a shop or marketplace. There is no checkout, no seller listings, no price comparison and no affiliate links, and posting links intended to help people buy tobacco breaks the <Link className="text-amber underline" href="/rules">community rules</Link>.</p>
      <h2 className="section-title">Notices</h2>
      <ul className="space-y-3 text-sm text-mute">
        <li><strong className="text-ink">Age.</strong> {s.age_notice}</li>
        <li><strong className="text-ink">Responsible use.</strong> {s.responsible_use_notice}</li>
        <li><strong className="text-ink">Jurisdiction.</strong> {s.jurisdiction_notice}</li>
        <li><strong className="text-ink">Health & safety.</strong> {s.health_notice}</li>
      </ul>
      <p className="text-sm text-mute">Quality badges such as “Community Tested” only describe how much community activity a recipe has. They are never a safety guarantee or an endorsement.</p>
    </div>
  );
}
