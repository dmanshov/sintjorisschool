import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/site-url';

/**
 * Evaluated per request, not at build time.
 *
 * Otherwise the staging lock's disallow-all would be baked in at build and go
 * stale: turning SITE_ACCESS_CODE on or off would not change robots.txt until
 * the next deploy, which is exactly when you least want a stale answer. It also
 * lets the base URL be read from the request rather than fixed at build time.
 */
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  /**
   * While the staging lock is on, ask every crawler to stay away entirely.
   * The lock already answers 401 to crawlers, so this is the second layer: it
   * keeps an unfinished site off Google even if the middleware is ever bypassed,
   * and stops a staging URL competing with the school's real domain later.
   */
  if (process.env.SITE_ACCESS_CODE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  const base = await getSiteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Everything behind a login, and the CSV export.
        disallow: ['/profiel', '/admin', '/meldpunt', '/login', '/wachtwoord-herstellen'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
