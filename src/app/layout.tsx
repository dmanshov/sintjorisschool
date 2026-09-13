import type { Metadata, Viewport } from 'next';
import { Outfit, Readex_Pro } from 'next/font/google';
import { school } from '@/lib/site';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const readex = Readex_Pro({
  subsets: ['latin'],
  variable: '--font-readex',
  display: 'swap',
});

/**
 * These tags were in web/index.html of the FlutterFlow build. They are kept
 * verbatim, because the Facebook and WhatsApp previews the school shares depend
 * on them. Unlike the old build, individual pages can now override them — a
 * canvas-rendered Flutter app served one set of tags for every URL.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.sintjorisschool.be'),
  title: {
    default: `${school.name} | ${school.tagline}`,
    template: `%s | ${school.name}`,
  },
  description: school.description,
  applicationName: school.name,
  openGraph: {
    type: 'website',
    locale: 'nl_BE',
    siteName: school.name,
    title: `${school.name} | ${school.tagline}`,
    description: school.description,
    images: ['/draak_socials.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${school.name} | ${school.tagline}`,
    description: school.description,
    images: ['/draak_socials.png'],
  },
  icons: { icon: '/draak_socials.png', apple: '/draak_socials.png' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#f1f4f8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl-BE" className={`${outfit.variable} ${readex.variable}`}>
      <body>
        <a
          href="#inhoud"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Ga naar de inhoud
        </a>
        {children}
      </body>
    </html>
  );
}
