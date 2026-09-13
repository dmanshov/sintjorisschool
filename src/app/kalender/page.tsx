import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, PageHeader, Section } from '@/components/layout';
import { school } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Kalender',
  description: 'De schoolkalender van de Sint-Jorisschool: vrije dagen, activiteiten en oudercontacten.',
};

export default function KalenderPage() {
  return (
    <>
      <SiteHeader current="/kalender" />

      <main id="inhoud">
        <PageHeader
          title="Kalender"
          intro="Alle vrije dagen, activiteiten en oudercontacten op één plek. Abonneer je op de kalender om hem automatisch in je eigen agenda te krijgen."
        />

        <Section>
          <Card className="p-0">
            {/*
              The school keeps this calendar in Google Calendar and edits it there.
              Embedding it means there is nothing to keep in sync — and, unlike the
              old build, the iframe is lazy-loaded so it does not block the page.
            */}
            <iframe
              src={school.links.calendarEmbed}
              title="Schoolkalender van de Sint-Jorisschool"
              loading="lazy"
              className="h-[70vh] min-h-[520px] w-full rounded-card border-0"
            />
          </Card>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={school.links.calendarEmbed}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Open in nieuw venster
            </a>
            <a
              href={school.links.calendarIcs}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
            >
              Abonneren (ICS)
            </a>
          </div>

          <p className="mt-4 text-sm text-ink-muted">
            Lukt het niet om de kalender te zien? Gebruik dan de knop &ldquo;Open in nieuw
            venster&rdquo;. Sommige browsers blokkeren ingebedde vensters.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
