import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, PageHeader, Section } from '@/components/layout';
import { PostCard } from '@/components/post-card';
import { getViewer } from '@/lib/auth/session';
import { countPosts, listPosts } from '@/lib/data/posts';
import { POST_CLASSROOMS } from '@db/schema';

export const revalidate = 120;

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Schoolkrant',
  description:
    'De online schoolkrant van de Sint-Jorisschool: nieuws en foto’s per klas, van de kleuterschool tot het zesde leerjaar.',
};

export default async function SchoolkrantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();

  const rawKlas = Array.isArray(params.klas) ? params.klas[0] : params.klas;
  const klas = (POST_CLASSROOMS as readonly string[]).includes(rawKlas ?? '') ? rawKlas! : null;

  const page = Math.max(1, Number(Array.isArray(params.p) ? params.p[0] : params.p) || 1);

  const classrooms = klas ? [klas] : undefined;
  const [posts, total] = await Promise.all([
    listPosts({
      classrooms,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      viewerId: viewer?.user.id ?? null,
    }),
    countPosts(classrooms),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPublish = Boolean(viewer?.isAdmin || viewer?.isTeacher);

  return (
    <>
      <SiteHeader current="/schoolkrant" />

      <main id="inhoud">
        <PageHeader
          title="Schoolkrant"
          intro="Nieuws, verhalen en foto's uit elke klas. Filter op een klas om enkel die artikels te zien."
        />

        {/*
          Filter chips are links, not client state: a parent can bookmark or share
          "de schoolkrant van L3", and search engines can index each class feed.
        */}
        <nav aria-label="Filter op klas" className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-4 sm:px-6">
            <FilterChip href="/schoolkrant" label="Alle klassen" active={klas === null} />
            {POST_CLASSROOMS.map((room) => (
              <FilterChip
                key={room}
                href={`/schoolkrant?klas=${room}`}
                label={room}
                active={klas === room}
              />
            ))}
          </div>
        </nav>

        <Section>
          {canPublish ? (
            <div className="mb-8">
              <Link
                href="/admin?tab=Schoolkrant"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft"
              >
                Nieuw artikel posten
              </Link>
            </div>
          ) : null}

          {posts.length === 0 ? (
            <Card>
              <p className="text-ink-muted">
                {klas
                  ? 'Er zijn geen artikels terug te vinden voor deze klas-selectie.'
                  : 'Er zijn nog geen artikels gepubliceerd.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} canLike={Boolean(viewer)} priority={index === 0} />
              ))}
            </div>
          )}

          {pageCount > 1 ? (
            <nav aria-label="Paginering" className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => {
                const query = new URLSearchParams();
                if (klas) query.set('klas', klas);
                if (number > 1) query.set('p', String(number));
                const href = query.size > 0 ? `/schoolkrant?${query}` : '/schoolkrant';
                const isCurrent = number === page;
                return (
                  <Link
                    key={number}
                    href={href}
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={`Pagina ${number}`}
                    className={`min-w-10 rounded-lg px-3 py-2 text-center text-sm transition-colors ${
                      isCurrent
                        ? 'bg-primary font-semibold text-white'
                        : 'border border-line text-ink-muted hover:border-primary hover:text-primary'
                    }`}
                  >
                    {number}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {!viewer ? (
            <Card className="mt-10 bg-canvas shadow-none">
              <p className="text-[15px]">
                <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
                  Meld je aan
                </Link>{' '}
                om artikels leuk te vinden en om bestellingen te plaatsen voor je kinderen.
              </p>
            </Card>
          ) : null}
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-primary font-semibold text-white'
          : 'border border-line text-ink-muted hover:border-primary hover:text-primary'
      }`}
    >
      {label}
    </Link>
  );
}
