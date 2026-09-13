import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, PageHeader, Section } from '@/components/layout';
import { getSiteOrigin } from '@/lib/site-url';
import { school, teacherContacts } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Contacteer de Sint-Jorisschool: ${school.address.street}, ${school.address.postalCode} ${school.address.city}. Telefoon ${school.phone.display}.`,
};

/**
 * Local-business structured data. A school with a physical address wants to
 * appear in a map result; the old canvas-rendered build could not say any of this.
 *
 * `url` is built from the request (see src/lib/site-url.ts), not a fixed domain,
 * so this page carries no reference to any particular hostname.
 */
async function buildStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: school.name,
    description: school.description,
    telephone: school.phone.tel,
    email: school.email.general,
    address: {
      '@type': 'PostalAddress',
      streetAddress: school.address.street,
      postalCode: school.address.postalCode,
      addressLocality: school.address.city,
      addressCountry: 'BE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: school.coordinates.lat,
      longitude: school.coordinates.lng,
    },
    url: await getSiteOrigin(),
  };
}

export default async function ContactPage() {
  const structuredData = await buildStructuredData();

  return (
    <>
      <SiteHeader current="/contact" />

      <main id="inhoud">
        <script
          type="application/ld+json"
          // Generated above from our own constants plus the current request's origin.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        <PageHeader
          title="Contact"
          intro="Een vraag, een idee of gewoon eens langskomen voor een babbel? We horen het graag."
        />

        <Section>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <h2 className="font-display text-xl font-semibold">Sint-Jorisschool</h2>
              <address className="mt-3 space-y-3 text-[15px] not-italic">
                <p>
                  {school.address.street}
                  <br />
                  {school.address.postalCode} {school.address.city}
                </p>
                <p>
                  <a href={`tel:${school.phone.tel}`} className="text-primary underline-offset-2 hover:underline">
                    {school.phone.display}
                  </a>
                </p>
                <p>
                  <a
                    href={`mailto:${school.email.general}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {school.email.general}
                  </a>
                  <br />
                  <a
                    href={`mailto:${school.email.directie}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {school.email.directie}
                  </a>
                </p>
              </address>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`mailto:${school.email.general}`}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
                >
                  Stuur ons een bericht
                </a>
                <a
                  href={school.links.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  Route (Google Maps)
                </a>
                <a
                  href={school.links.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-primary hover:text-primary"
                >
                  Route (Waze)
                </a>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <iframe
                title={`Kaart met de locatie van de ${school.name}`}
                loading="lazy"
                className="h-80 w-full border-0 lg:h-full lg:min-h-[22rem]"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${school.coordinates.lng - 0.006}%2C${school.coordinates.lat - 0.003}%2C${school.coordinates.lng + 0.006}%2C${school.coordinates.lat + 0.003}&layer=mapnik&marker=${school.coordinates.lat}%2C${school.coordinates.lng}`}
              />
            </Card>
          </div>
        </Section>

        <Section title="Leerkrachten" intro="Een vraag voor een specifieke leerkracht? Hier vind je hun email adres.">
          <div className="grid gap-6 md:grid-cols-2">
            {[teacherContacts.kleuterschool, teacherContacts.lagereSchool].map((section) => (
              <Card key={section.title}>
                <h3 className="font-display text-lg font-semibold">{section.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{section.intro}</p>

                {section.groups.map((group) => (
                  <div key={group.label} className="mt-5">
                    <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      {group.label}
                    </h4>
                    <ul className="mt-2 divide-y divide-line">
                      {group.people.map((person) => (
                        <li key={person.email} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                          <span className="text-[15px]">{person.name}</span>
                          <a
                            href={`mailto:${person.email}`}
                            className="text-sm text-primary underline-offset-2 hover:underline"
                          >
                            {person.email}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
