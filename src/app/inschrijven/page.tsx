import type { Metadata } from 'next';
import Image from 'next/image';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DbNotice } from '@/components/db-notice';
import { Card, CmsText, DocumentLink, PageHeader, Section } from '@/components/layout';
import { getContentSafe } from '@/lib/data/content';
import { documents, school } from '@/lib/site';

/**
 * Rendered per request, never prerendered at build time.
 *
 * The header shows whether you are logged in, so it reads the session cookie and
 * every page is dynamic regardless. Saying so explicitly matters for deployment:
 * without it Next attempts a build-time prerender, which opens a database
 * connection, and the build then fails on any host where the database is not yet
 * migrated or is cold-starting. A build should not depend on a running database.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inschrijven',
  description:
    'Inschrijven in de Sint-Jorisschool in Tielt-Winge verloopt via het online aanmeldingsplatform van de gemeente.',
};

export default async function InschrijvenPage() {
  const { content, failure } = await getContentSafe();

  return (
    <>
      <SiteHeader />

      <DbNotice failure={failure} />

      <main id="inhoud">
        <PageHeader
          title="Inschrijven"
          intro="Wil je je kind inschrijven in onze school? Dat verloopt via het online aanmeldingsplatform van Tielt-Winge."
          image={{ src: '/images/Speelplaats.jpg', alt: 'De speelplaats' }}
        />

        <Section>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CmsText
                value={content.inschrijvingen}
                fallback="Inschrijvingen verlopen via het centrale aanmeldingsplatform voor het basisonderwijs van Tielt-Winge. Daar vind je de aanmeldingsperiodes en de verdere stappen. Heb je vragen, neem dan zeker contact met ons op — we helpen je graag verder."
              />

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={school.links.aanmelden}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
                >
                  Online platform voor inschrijvingen
                </a>
                <DocumentLink href={documents.infobrochure} label="Infobrochure" />
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-lg font-semibold">Liever eerst eens langskomen?</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                Heel graag. Bel ons of stuur een mailtje en we plannen een rondleiding op een moment dat
                voor jou past.
              </p>
              <dl className="mt-4 space-y-2 text-[15px]">
                <div>
                  <dt className="sr-only">Telefoon</dt>
                  <dd>
                    <a href={`tel:${school.phone.tel}`} className="text-primary underline-offset-2 hover:underline">
                      {school.phone.display}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${school.email.general}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {school.email.general}
                    </a>
                  </dd>
                </div>
              </dl>
              <Image
                src="/images/Sportzaal.png"
                alt=""
                width={480}
                height={300}
                className="mt-5 h-40 w-full rounded-card object-cover"
              />
            </Card>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
