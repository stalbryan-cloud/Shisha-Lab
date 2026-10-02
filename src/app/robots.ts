import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/moderation', '/me', '/settings', '/notifications', '/create', '/api/', '/auth/', '/search'] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
