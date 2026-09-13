import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, PageHeader, Section } from '@/components/layout';
import { getCurrentUser } from '@/lib/auth/session';
import { meldpunt, school } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Meldpunt klokkenluiders',
  description:
    'Vermoed je dat bepaalde regelgeving niet correct wordt nageleefd? Hier vind je het interne meldpunt voor klokkenluiders.',
  robots: { index: false, follow: false },
};

export default async function MeldpuntPage() {
  // The old app required a login for this page, so it stays behind one.
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/meldpunt');

  return (
    <>
      <SiteHeader />

      <main id="inhoud">
        <PageHeader
          title="Meldpunt"
          intro="Weet je of vermoed je dat bepaalde regelgeving niet correct wordt nageleefd? Dan kan je dit melden bij het interne meldpunt voor klokkenluiders."
        />

        <Section>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <h2 className="font-display text-xl font-semibold">Intern meldpunt</h2>
              <p className="mt-3 text-[15px] leading-relaxed">
                Meldingen worden vertrouwelijk behandeld. Je kan terecht bij het meldpunt van{' '}
                {meldpunt.organisation}.
              </p>

              <dl className="mt-5 space-y-4 text-[15px]">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Adres</dt>
                  <dd className="mt-1">{meldpunt.address}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Telefoon</dt>
                  <dd className="mt-1">
                    <a href={`tel:${meldpunt.phone.tel}`} className="text-primary underline-offset-2 hover:underline">
                      {meldpunt.phone.display}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Email</dt>
                  <dd className="mt-1">
                    <a
                      href={`mailto:${meldpunt.email}`}
                      className="break-all text-primary underline-offset-2 hover:underline"
                    >
                      {meldpunt.email}
                    </a>
                  </dd>
                </div>
              </dl>

              <a
                href={school.links.klokkenluiders}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Meer informatie over de klokkenluidersregeling
              </a>
            </Card>

            <Card className="bg-canvas shadow-none">
              <h2 className="font-display text-lg font-semibold">Liever eerst intern?</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                Je kan ook altijd eerst de directie aanspreken. Vaak is een gesprek de snelste weg naar een
                oplossing.
              </p>
              <a
                href={`mailto:${school.email.directie}`}
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {school.email.directie}
              </a>
            </Card>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
