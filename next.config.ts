import type { NextConfig } from 'next';

/**
 * The FlutterFlow app served these exact paths. They are kept as the canonical
 * URLs so existing bookmarks, Facebook posts and Google results keep working.
 * Kebab-case aliases redirect onto them for anything written from here on.
 */
const config: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Firebase Storage download URLs already in the database stay valid until
      // migrate-storage.ts has re-hosted them. Both old and new hosts allowed.
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [{ protocol: 'https' as const, hostname: process.env.NEXT_PUBLIC_MEDIA_HOST }]
        : []),
    ],
  },
  async redirects() {
    return [
      { source: '/onze-school', destination: '/onzeSchool', permanent: true },
      { source: '/home-page', destination: '/homePage', permanent: true },
      { source: '/aanmelden', destination: '/login', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default config;
