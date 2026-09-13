import type { Metadata } from 'next';
import Image from 'next/image';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, CmsText, Disclosure, PageHeader, Section, TabNav } from '@/components/layout';
import { getContent } from '@/lib/data/content';
import { clb, school } from '@/lib/site';
import {
  clbInfo,
  ondersteuningsnetwerk,
  ouderraad,
  schoolbestuur,
  schoolteam,
  scholengemeenschap,
  visie,
} from '@/lib/copy';

export const revalidate = 600;

const TABS = [
  { key: 'OverOns', label: 'Over ons' },
  { key: 'Visie', label: 'Visie' },
  { key: 'Partners', label: 'Partners' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const metadata: Metadata = {
  title: 'Onze school',
  description:
    'Ontdek de krachten achter onze schoolwerking, welke visie we uitdragen en op welke externe partners we zoal kunnen rekenen.',
};

/** Accepts both `?tab=` and the old app's `?navParameter=`. */
function resolveTab(params: Record<string, string | string[] | undefined>): TabKey {
  const raw = params.tab ?? params.navParameter;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.some((t) => t.key === value) ? (value as TabKey) : 'OverOns';
}

export default async function OnzeSchoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tab = resolveTab(await searchParams);
  const content = await getContent();

  return (
    <>
      <SiteHeader current="/onzeSchool" />

      <main id="inhoud">
        <PageHeader
          title="Onze school"
          intro="Ontdek de krachten achter onze schoolwerking, welke visie we uitdragen en op welke externe partners we zoal kunnen rekenen."
          image={{ src: '/images/Personeel_2026-2027.jpg', alt: 'Het schoolteam van de Sint-Jorisschool' }}
        />
        <TabNav tabs={TABS} active={tab} basePath="/onzeSchool" />

        {tab === 'OverOns' ? (
          <>
            <Section title={schoolteam.title} intro={schoolteam.body}>
              {content.teamFoto ? (
                <Image
                  src={content.teamFoto}
                  alt="Het volledige schoolteam"
                  width={1200}
                  height={700}
                  className="mb-6 w-full rounded-card object-cover shadow-card"
                  unoptimized
                />
              ) : (
                <Image
                  src="/images/Personeel_2026-2027.jpg"
                  alt="Het volledige schoolteam"
                  width={1200}
                  height={700}
                  className="mb-6 w-full rounded-card object-cover shadow-card"
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ['Directeur', content.teamDirecteur],
                    ['Administratief medewerker en preventieadviseur', content.teamAdministratie],
                    ['Leerkrachtenteam kleuterschool', content.teamKleuterschool],
                    ['Leerkrachtenteam lagere school', content.teamLagereSchool],
                    ['Ambulante leerkrachten', content.teamAmbulant],
                    ['Zorg', content.teamZorg],
                    ['Gymleerkracht', content.teamGym],
                    ['Onderhoudspersoneel', content.teamOnderhoud],
                  ] as const
                )
                  .filter(([, value]) => value && value.trim().length > 0)
                  .map(([label, value]) => (
                    <Card key={label}>
                      <h3 className="font-display text-base font-semibold">{label}</h3>
                      <div className="mt-2">
                        <CmsText value={value} />
                      </div>
                    </Card>
                  ))}
              </div>
            </Section>

            <Section title={ouderraad.title} intro={ouderraad.intro} className="pt-0">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <Image
                  src="/images/Ouderraad.png"
                  alt="De ouderraad"
                  width={600}
                  height={420}
                  className="h-full max-h-80 w-full rounded-card object-cover shadow-card"
                />
                <div className="space-y-4">
                  <Card>
                    <h3 className="font-display text-base font-semibold">Doel</h3>
                    <p className="mt-2 text-[15px] leading-relaxed">{ouderraad.doel}</p>
                  </Card>
                  <Card>
                    <h3 className="font-display text-base font-semibold">Ouders</h3>
                    <ul className="mt-2 space-y-1 text-[15px]">
                      {ouderraad.ouders.map((parent) => (
                        <li key={parent}>{parent}</li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>

              <h3 className="mt-8 font-display text-xl font-semibold">Hoe. Wat. Waar.</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {ouderraad.werking.map((item) => (
                  <Card key={item.title}>
                    <h4 className="font-display text-base font-semibold">{item.title}</h4>
                    <p className="prose-cms mt-2 text-[15px]">{item.body}</p>
                  </Card>
                ))}
              </div>

              <Card className="mt-6 border-l-4 border-secondary">
                <h4 className="font-display text-base font-semibold">Kriebelt het?</h4>
                <p className="mt-2 text-[15px] leading-relaxed">{ouderraad.kriebelt}</p>
                <a
                  href={`mailto:${school.email.ouderraad}`}
                  className="mt-3 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {school.email.ouderraad}
                </a>
              </Card>
            </Section>

            <Section title={schoolbestuur.title} intro={schoolbestuur.body} className="pt-0">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                <Image
                  src="/images/Schoolbestuur.png"
                  alt="Het schoolbestuur"
                  width={520}
                  height={380}
                  className="h-56 w-full rounded-card object-cover shadow-card"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <h3 className="font-display text-base font-semibold">Voorzitter</h3>
                    <div className="mt-2">
                      <CmsText value={content.bestuurVoorzitter} fallback="Nog niet ingevuld." />
                    </div>
                  </Card>
                  <Card>
                    <h3 className="font-display text-base font-semibold">Leden</h3>
                    <div className="mt-2">
                      <CmsText value={content.bestuurLeden} fallback="Nog niet ingevuld." />
                    </div>
                  </Card>
                </div>
              </div>
            </Section>

            <Section title={scholengemeenschap.title} className="pt-0">
              <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.4fr]">
                <Image
                  src="/images/4sprong.png"
                  alt="Scholengemeenschap de4sprong"
                  width={520}
                  height={380}
                  className="h-48 w-full rounded-card bg-white object-contain p-6 shadow-card"
                />
                <Card>
                  <p className="text-[15px] leading-relaxed">{scholengemeenschap.body}</p>
                </Card>
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'Visie' ? (
          <Section>
            <div className="space-y-4">
              <Disclosure summary={visie.opvoedingsproject.title} defaultOpen>
                <ul className="space-y-2 text-[15px]">
                  {visie.opvoedingsproject.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-tertiary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </Disclosure>

              <Disclosure summary={visie.zorgvisie.title}>
                <p className="text-[15px] leading-relaxed">{visie.zorgvisie.intro}</p>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {visie.zorgvisie.points.map((point) => (
                    <li key={point.slice(0, 40)} className="flex gap-3 leading-relaxed">
                      <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-alternate" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Image
                  src="/images/Inclusie.jpg"
                  alt=""
                  width={900}
                  height={500}
                  className="mt-6 w-full rounded-card object-cover"
                />
              </Disclosure>

              <Disclosure summary={visie.muzisch.title}>
                <p className="text-[15px] leading-relaxed">{visie.muzisch.intro}</p>
                <Image
                  src="/images/Muzische_visie.png"
                  alt="De muzische visie, uitgebeeld als een tuin"
                  width={900}
                  height={600}
                  className="mt-5 w-full rounded-card bg-white object-contain p-4"
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {visie.muzisch.parts.map((part) => (
                    <div key={part.title} className="rounded-lg bg-canvas p-4">
                      <h4 className="font-display text-base font-semibold">{part.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed">{part.body}</p>
                    </div>
                  ))}
                </div>
              </Disclosure>

              <Disclosure summary={visie.antipest.title}>
                <h4 className="font-display text-base font-semibold">Preventie</h4>
                <ul className="mt-2 space-y-2 text-[15px]">
                  {visie.antipest.preventie.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-tertiary" />
                      {point}
                    </li>
                  ))}
                </ul>
                <h4 className="mt-5 font-display text-base font-semibold">Aanpak van pestgedrag</h4>
                <p className="mt-2 text-[15px] leading-relaxed">{visie.antipest.aanpak}</p>
              </Disclosure>
            </div>
          </Section>
        ) : null}

        {tab === 'Partners' ? (
          <Section>
            <div className="space-y-4">
              <Disclosure summary={clbInfo.title} defaultOpen>
                <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
                  <Image
                    src="/images/CLB.png"
                    alt="Vrij CLB Brabant Oost"
                    width={420}
                    height={300}
                    className="h-40 w-full rounded-card bg-white object-contain p-5"
                  />
                  <div>
                    <p className="text-[15px] leading-relaxed">{clbInfo.intro}</p>
                    <ul className="mt-3 space-y-1 text-[15px]">
                      {clbInfo.domains.map((domain) => (
                        <li key={domain} className="flex gap-3">
                          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-alternate" />
                          {domain}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Card>
                    <h4 className="font-display text-base font-semibold">Vestiging</h4>
                    <p className="prose-cms mt-2 text-sm">{clb.vestiging}</p>
                  </Card>
                  <Card>
                    <h4 className="font-display text-base font-semibold">Vestigingscoördinator</h4>
                    <div className="mt-2 text-sm">
                      <CmsText value={content.clbCoordinator} fallback="Nog niet ingevuld." />
                    </div>
                  </Card>
                  <Card>
                    <h4 className="font-display text-base font-semibold">Medewerkers</h4>
                    <div className="mt-2 text-sm">
                      <CmsText value={content.clbMedewerkers} fallback="Nog niet ingevuld." />
                    </div>
                  </Card>
                </div>

                <div className="mt-5 rounded-lg bg-canvas p-4">
                  <h4 className="font-display text-base font-semibold">Hoe bereiken?</h4>
                  <p className="mt-1 text-sm leading-relaxed">{clbInfo.bereiken}</p>
                  <a
                    href={school.links.clb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Website van het CLB
                  </a>
                </div>
              </Disclosure>

              <Disclosure summary={ondersteuningsnetwerk.title}>
                <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
                  <Image
                    src="/images/Netwerk.png"
                    alt="Ondersteuningsnetwerk"
                    width={420}
                    height={300}
                    className="h-40 w-full rounded-card bg-white object-contain p-5"
                  />
                  <div className="space-y-4">
                    <p className="text-[15px] leading-relaxed">{ondersteuningsnetwerk.intro}</p>
                    <Card>
                      <h4 className="font-display text-base font-semibold">Vestiging</h4>
                      <div className="mt-2 text-sm">
                        <CmsText value={content.ondersteuningVestiging} fallback="Nog niet ingevuld." />
                      </div>
                    </Card>
                    <Card>
                      <h4 className="font-display text-base font-semibold">Voorwaarden voor ondersteuning</h4>
                      <div className="mt-2 text-sm">
                        <CmsText value={content.ondersteuningVoorwaarden} fallback="Nog niet ingevuld." />
                      </div>
                    </Card>
                  </div>
                </div>
              </Disclosure>

              <Disclosure summary="Buitenschoolse opvang">
                <CmsText
                  value={content.opvang}
                  fallback="De informatie over de buitenschoolse opvang wordt binnenkort toegevoegd."
                />
              </Disclosure>
            </div>
          </Section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
