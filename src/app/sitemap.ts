import type { MetadataRoute } from 'next';

/**
 * A canvas-rendered Flutter app could not offer this at all. Every public page is
 * listed at its canonical (original) URL, so nothing the school has already shared
 * or that Google has already indexed changes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.sintjorisschool.be';
  const now = new Date();

  const paths = [
    { path: '/', priority: 1 },
    { path: '/onzeSchool', priority: 0.8 },
    { path: '/praktisch', priority: 0.8 },
    { path: '/kalender', priority: 0.6 },
    { path: '/schoolkrant', priority: 0.8 },
    { path: '/contact', priority: 0.7 },
    { path: '/inschrijven', priority: 0.9 },
  ];

  return paths.map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/schoolkrant' ? 'weekly' : 'monthly',
    priority,
  }));
}
