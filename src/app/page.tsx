import Image from 'next/image';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, CmsText, Section } from '@/components/layout';
import { PostCard } from '@/components/post-card';
import { DbNotice } from '@/components/db-notice';
import { getViewer } from '@/lib/auth/session';
import { getContentSafe } from '@/lib/data/content';
import { classroomsForParent } from '@/lib/data/children';
import { safeRead } from '@/lib/db-status';
import { listPostsSafe } from '@/lib/data/posts';
import { school } from '@/lib/site';

/**
 * The old app had two near-identical pages here: HomePage for visitors and Home
 * for signed-in parents, differing only in which posts they listed. One page
 * that adapts is the same site with half the code.
 */
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

export default async function WelkomPage() {
  const viewer = await getViewer();
  const { content, failure } = await getContentSafe();

  // Signed-in parents see the pinned articles for their own children's classes
  // first; visitors see the pinned articles that were published school-wide.
  const classrooms = viewer
    ? (await safeRead('classrooms', () => classroomsForParent(viewer.user.id), [] as string[])).value
    : [];
  const { posts: pinned } = await listPostsSafe({
    pinnedOnly: true,
    limit: 6,
    viewerId: viewer?.user.id ?? null,
    classrooms: classrooms.length > 0 ? [...classrooms, 'LEESKLAS'] : undefined,
  });

  const posts =
    pinned.length > 0
      ? pinned
      : (await listPostsSafe({ pinnedOnly: true, limit: 6, viewerId: viewer?.user.id ?? null })).posts;

  return (
    <>
      <SiteHeader current="/" />

      <DbNotice failure={failure} />

      <main id="inhoud">
        {/* Hero */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
            <div>
              <h1 className="font-display text-4xl leading-tight font-semibold md:text-5xl">Welkom!</h1>
              <div className="mt-5 max-w-xl">
                <CmsText value={content.welkom} fallback={school.description} />
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/inschrijven"
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
                >
                  Inschrijven
                </Link>
                <Link
                  href="/schoolkrant"
                  className="rounded-lg border border-primary px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  Schoolkrant
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Image
                src="/images/Speelplaats.jpg"
                alt="De speelplaats van de Sint-Jorisschool"
                width={560}
                height={420}
                priority
                className="col-span-2 h-48 w-full rounded-card object-cover shadow-card md:h-64"
              />
              <Image
                src="/images/Sportzaal.png"
                alt="De sportzaal"
                width={320}
                height={240}
                className="h-28 w-full rounded-card object-cover shadow-card md:h-36"
              />
              <Image
                src="/images/Sjokotof.jpg"
                alt="Een schoolactiviteit"
                width={320}
                height={240}
                className="h-28 w-full rounded-card object-cover shadow-card md:h-36"
              />
            </div>
          </div>
        </section>

        {/* Laatste nieuws */}
        <Section
          title="Laatste nieuws"
          intro="Blijf op de hoogte van wat er zich afspeelt op onze school. Klik zeker ook eens door naar onze schoolkrant om de laatste nieuwtjes per klas te ontdekken."
        >
          {posts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} canLike={Boolean(viewer)} priority={index === 0} />
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-ink-muted">
                Er staan momenteel geen berichten op de homepage.{' '}
                <Link href="/schoolkrant" className="text-primary underline-offset-2 hover:underline">
                  Bekijk de schoolkrant
                </Link>{' '}
                voor alle artikels.
              </p>
            </Card>
          )}

          <div className="mt-8">
            <Link
              href="/schoolkrant"
              className="rounded-lg border border-primary px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Naar de schoolkrant
            </Link>
          </div>
        </Section>

        {/* Onze school */}
        <Section
          title="Onze school"
          intro="Ontdek de krachten achter onze schoolwerking, welke visie we uitdragen en op welke externe partners we zoal kunnen rekenen."
          className="pt-0"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <TeaserCard
              href="/onzeSchool?tab=OverOns"
              image="/images/Personeel_2026-2027.jpg"
              title="Over ons"
              body="Het schoolteam, de ouderraad, het schoolbestuur en onze scholengemeenschap."
            />
            <TeaserCard
              href="/onzeSchool?tab=Visie"
              image="/images/Muzische_visie.png"
              title="Visie"
              body="Ons opvoedingsproject, de zorgvisie, de muzische visie en het anti-pestbeleid."
            />
            <TeaserCard
              href="/onzeSchool?tab=Partners"
              image="/images/CLB.png"
              title="Partners"
              body="CLB, het ondersteuningsnetwerk en de buitenschoolse opvang."
            />
          </div>
        </Section>

        {/* Praktisch */}
        <Section
          title="Praktisch"
          intro="Op zoek naar het schoolreglement, doorlichtingsverslag of documenten voor de verzekering? Of wens je een drankkaart of warme maaltijd te bestellen?"
          className="pt-0"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <TeaserCard
              href="/praktisch?tab=Info"
              image="/images/Schoolreglement.png"
              title="Info"
              body="Schoolreglement, doorlichtingsverslag en gegevensbescherming."
            />
            <TeaserCard
              href="/praktisch?tab=Bestellingen"
              image="/images/Drankkaarten.png"
              title="Bestellingen"
              body="Drankkaarten, warme maaltijden, badmutsen en gym T-shirts."
            />
            <TeaserCard
              href="/praktisch?tab=Gezondheid"
              image="/images/Ziekte.jpeg"
              title="Gezondheid"
              body="Ziekte en medicatie, kriebelbeestjes en de schoolverzekering."
            />
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}

function TeaserCard({
  href,
  image,
  title,
  body,
}: {
  href: string;
  image: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="card group overflow-hidden p-0 transition-shadow hover:shadow-lg">
      <Image src={image} alt="" width={480} height={300} className="aspect-[16/10] w-full object-cover" />
      <div className="p-5">
        <h3 className="font-display text-lg font-semibold group-hover:underline">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
      </div>
    </Link>
  );
}
