import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.sintjorisschool.be';
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
