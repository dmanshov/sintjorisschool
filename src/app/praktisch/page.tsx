import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DbNotice } from '@/components/db-notice';
import { Card, CmsText, Disclosure, DocumentLink, PageHeader, Section, TabNav } from '@/components/layout';
import { getViewer } from '@/lib/auth/session';
import { getContentSafe } from '@/lib/data/content';
import { documents, school } from '@/lib/site';
import { praktischCopy } from '@/lib/copy';
import { CLASSROOMS } from '@db/schema';

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

const TABS = [
  { key: 'Info', label: 'Info' },
  { key: 'Bestellingen', label: 'Bestellingen' },
  { key: 'Gezondheid', label: 'Gezondheid' },
  { key: 'Benodigdheden', label: 'Benodigdheden' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const metadata: Metadata = {
  title: 'Praktisch',
  description:
    'Schoolreglement, doorlichtingsverslag, verzekering, benodigdheden per klas en het bestellen van drankkaarten, warme maaltijden, badmutsen en gym T-shirts.',
};

function resolveTab(params: Record<string, string | string[] | undefined>): TabKey {
  const raw = params.tab ?? params.navParameter;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.some((t) => t.key === value) ? (value as TabKey) : 'Info';
}

/** Maps a classroom code to the matching CMS field holding its supply list. */
const BENODIGDHEDEN_FIELD = {
  KK0: 'benodigdhedenKK0',
  KK1: 'benodigdhedenKK1',
  KK2: 'benodigdhedenKK2',
  KK3: 'benodigdhedenKK3',
  L1: 'benodigdhedenL1',
  L2A: 'benodigdhedenL2',
  L2B: 'benodigdhedenL2',
  L3: 'benodigdhedenL3',
  L4: 'benodigdhedenL4',
  L5A: 'benodigdhedenL5',
  L5B: 'benodigdhedenL5',
  L6: 'benodigdhedenL6',
} as const satisfies Record<(typeof CLASSROOMS)[number], string>;

export default async function PraktischPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tab = resolveTab(await searchParams);
  const { content, failure } = await getContentSafe();
  const viewer = await getViewer();
  const menuUrl = content.maaltijd.at(-1) ?? null;

  return (
    <>
      <SiteHeader current="/praktisch" />

      <DbNotice failure={failure} />

      <main id="inhoud">
        <PageHeader
          title="Praktisch"
          intro="Op zoek naar het schoolreglement, doorlichtingsverslag of documenten voor de verzekering? Of wens je een drankkaart of warme maaltijd te bestellen?"
          image={{ src: '/images/Praktisch.jpg', alt: 'De Sint-Jorisschool' }}
        />
        <TabNav tabs={TABS} active={tab} basePath="/praktisch" />

        {tab === 'Info' ? (
          <Section>
            <div className="grid gap-6 md:grid-cols-3">
              <InfoCard
                image="/images/Schoolreglement.png"
                title={praktischCopy.schoolreglement.title}
                body={praktischCopy.schoolreglement.body}
                href={content.schoolreglement || documents.infobrochure}
                cta="Openen"
              />
              <InfoCard
                image="/images/Inspectie.png"
                title={praktischCopy.doorlichting.title}
                body={praktischCopy.doorlichting.body}
                href={documents.doorlichtingsverslag}
                cta="Openen"
              />
              <InfoCard
                image="/images/Privacy_Policy.png"
                title={praktischCopy.privacy.title}
                body={praktischCopy.privacy.body}
                href={documents.privacyverklaring}
                cta="Openen"
              />
            </div>
          </Section>
        ) : null}

        {tab === 'Bestellingen' ? (
          <Section>
            <div className="grid gap-6 md:grid-cols-2">
              <OrderCard
                image="/images/Drankkaarten.png"
                title={praktischCopy.drankkaarten.title}
                body={praktischCopy.drankkaarten.body}
                loggedIn={Boolean(viewer)}
              />
              <OrderCard
                image="/images/Badmutsen.jpg"
                title={praktischCopy.badmutsen.title}
                body={praktischCopy.badmutsen.body}
                loggedIn={Boolean(viewer)}
              />
              <OrderCard
                image="/images/Benodigdheden.png"
                title={praktischCopy.gym.title}
                body={praktischCopy.gym.body}
                loggedIn={Boolean(viewer)}
              />
              <Card className="flex flex-col overflow-hidden p-0">
                <Image
                  src="/images/Warme_maaltijden.png"
                  alt=""
                  width={520}
                  height={320}
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="font-display text-lg font-semibold">{praktischCopy.maaltijden.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                    {content.maaltijdBericht?.trim() || praktischCopy.maaltijden.body}
                  </p>
                  {content.maaltijdMaand ? (
                    <p className="mt-3 text-sm font-medium text-secondary">
                      Bestelmaand: {content.maaltijdMaand}
                      {content.maaltijdDatums.length === 0 ? ' — momenteel gesloten' : ''}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-3">
                    {menuUrl ? <DocumentLink href={menuUrl} label="Menu bekijken" /> : null}
                    <Link
                      href={viewer ? '/profiel?tab=Maaltijd' : '/login?next=/profiel'}
                      className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
                    >
                      {viewer ? 'Bestellen' : 'Aanmelden'}
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </Section>
        ) : null}

        {tab === 'Gezondheid' ? (
          <Section>
            <div className="space-y-4">
              <Disclosure summary={praktischCopy.luizen.title} defaultOpen>
                <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
                  <Image
                    src="/images/Luizen.png"
                    alt=""
                    width={420}
                    height={300}
                    className="h-40 w-full rounded-card bg-white object-contain p-4"
                  />
                  <div>
                    <p className="prose-cms text-[15px]">{praktischCopy.luizen.body}</p>
                    <a
                      href={school.links.luizen}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      Nat-kam-test en stappenplan
                    </a>
                  </div>
                </div>
              </Disclosure>

              <Disclosure summary={praktischCopy.ziekte.title}>
                <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
                  <Image
                    src="/images/Ziekte.jpeg"
                    alt=""
                    width={420}
                    height={300}
                    className="h-40 w-full rounded-card object-cover"
                  />
                  <div>
                    <CmsText value={content.ziekte} fallback={praktischCopy.ziekte.body} />
                    <div className="mt-4">
                      <DocumentLink href={documents.attestMedicijnen} label="Attest medicijnen" />
                    </div>
                  </div>
                </div>
              </Disclosure>

              <Disclosure summary={praktischCopy.verzekering.title}>
                <p className="text-[15px] leading-relaxed">{praktischCopy.verzekering.body}</p>

                <div className="mt-5 space-y-4">
                  <Card className="bg-canvas shadow-none">
                    <h4 className="font-display text-base font-semibold">
                      {praktischCopy.verzekering.ongeval.title}
                    </h4>
                    <p className="mt-2 text-[15px] leading-relaxed">
                      {praktischCopy.verzekering.ongeval.body}
                    </p>
                    <div className="mt-4">
                      <DocumentLink
                        href={documents.geneeskundigGetuigschrift}
                        label="Geneeskundig getuigschrift"
                      />
                    </div>
                  </Card>

                  <Card className="bg-canvas shadow-none">
                    <h4 className="font-display text-base font-semibold">
                      {praktischCopy.verzekering.vrijwilligers.title}
                    </h4>
                    <p className="mt-2 text-[15px] leading-relaxed">
                      {praktischCopy.verzekering.vrijwilligers.body}
                    </p>
                  </Card>
                </div>
              </Disclosure>
            </div>
          </Section>
        ) : null}

        {tab === 'Benodigdheden' ? (
          <Section title={praktischCopy.benodigdheden.title} intro={praktischCopy.benodigdheden.body}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CLASSROOMS.map((classroom) => {
                const value = content[BENODIGDHEDEN_FIELD[classroom]];
                const isLink = typeof value === 'string' && /^https?:\/\//.test(value.trim());
                return (
                  <Card key={classroom}>
                    <h3 className="font-display text-base font-semibold">Klas {classroom}</h3>
                    {isLink ? (
                      <div className="mt-3">
                        <DocumentLink href={value.trim()} label="Lijst openen" />
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">
                        <CmsText value={value} fallback="Nog niet beschikbaar." />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </Section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}

function InfoCard({
  image,
  title,
  body,
  href,
  cta,
}: {
  image: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <Image src={image} alt="" width={480} height={300} className="aspect-[16/10] w-full bg-white object-contain p-5" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-muted">{body}</p>
        <div className="mt-5">
          <DocumentLink href={href} label={cta} />
        </div>
      </div>
    </Card>
  );
}

function OrderCard({
  image,
  title,
  body,
  loggedIn,
}: {
  image: string;
  title: string;
  body: string;
  loggedIn: boolean;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <Image src={image} alt="" width={520} height={320} className="aspect-[16/9] w-full object-cover" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-muted">{body}</p>
        <div className="mt-5">
          <Link
            href={loggedIn ? '/profiel' : '/login?next=/profiel'}
            className="inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
          >
            {loggedIn ? 'Bestellen' : 'Aanmelden'}
          </Link>
        </div>
      </div>
    </Card>
  );
}
