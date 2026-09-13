import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card } from '@/components/layout';
import { mainNav } from '@/lib/site';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="inhoud" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-24">
        <h1 className="font-display text-3xl font-semibold">Deze pagina bestaat niet (meer)</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Misschien is de link verouderd. Hieronder vind je de belangrijkste pagina&apos;s.
        </p>
        <Card className="mt-8">
          <ul className="space-y-2">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-primary underline-offset-2 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
