import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, PageHeader, Section, TabNav } from '@/components/layout';
import {
  BulkStatusForm,
  ContentGroupForm,
  MealAdminPanel,
  OrderStatusToggle,
  PostAdminRow,
  PostEditor,
  ResyncClassroomsButton,
  UserRightsRow,
  type AdminUserRow,
} from '@/components/admin-forms';
import { getViewer } from '@/lib/auth/session';
import { CONTENT_FIELDS, getContent } from '@/lib/data/content';
import { listOrders, orderTotalsByClassroom } from '@/lib/data/orders';
import { listPosts } from '@/lib/data/posts';
import { countUsers, listAdmins, listTeachers, searchUsers } from '@/lib/data/users';
import { CLASSROOMS, POST_CLASSROOMS, type Order, type OrderType } from '@db/schema';

export const metadata: Metadata = {
  title: 'Administratie',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ADMIN_TABS = [
  { key: 'Leden', label: 'Ledenbeheer' },
  { key: 'Drankkaarten', label: 'Drankkaarten' },
  { key: 'Maaltijden', label: 'Maaltijden' },
  { key: 'Badmutsen', label: 'Badmutsen' },
  { key: 'Gym', label: 'Gym T-shirts' },
  { key: 'Schoolkrant', label: 'Schoolkrant' },
  { key: 'Inhoud', label: 'Inhoud' },
] as const;

const TEACHER_TABS = [
  { key: 'MijnKlas', label: 'Bestellingen voor mijn klas' },
  { key: 'Schoolkrant', label: 'Schoolkrant' },
] as const;

const ORDER_TAB_TYPE: Record<string, OrderType> = {
  Drankkaarten: 'Drankkaart',
  Badmutsen: 'Badmuts',
  Gym: 'Gym T-shirt',
  Maaltijden: 'Maaltijd',
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/admin');
  if (!viewer.isAdmin && !viewer.isTeacher) redirect('/profiel');

  const params = await searchParams;
  const tabs = viewer.isAdmin ? ADMIN_TABS : TEACHER_TABS;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = tabs.some((t) => t.key === rawTab) ? rawTab! : tabs[0].key;

  const search = String(Array.isArray(params.q) ? (params.q[0] ?? '') : (params.q ?? ''));

  return (
    <>
      <SiteHeader />

      <main id="inhoud">
        <PageHeader
          title="Administratie"
          intro={
            viewer.isAdmin
              ? 'Beheer leden, bestellingen, de schoolkrant en de inhoud van de website.'
              : `Beheer de bestellingen en artikels van ${viewer.teacherClassrooms.join(', ') || 'je klas'}.`
          }
        />
        <TabNav tabs={tabs} active={tab} basePath="/admin" />

        {tab === 'Leden' && viewer.isAdmin ? <MembersTab search={search} viewerId={viewer.user.id} /> : null}

        {tab === 'MijnKlas' ? (
          <TeacherOrdersTab classrooms={viewer.teacherClassrooms} />
        ) : null}

        {(tab === 'Drankkaarten' || tab === 'Badmutsen' || tab === 'Gym') && viewer.isAdmin ? (
          <SimpleOrdersTab type={ORDER_TAB_TYPE[tab]!} />
        ) : null}

        {tab === 'Maaltijden' && viewer.isAdmin ? <MealsTab /> : null}

        {tab === 'Schoolkrant' ? (
          <SchoolkrantTab
            isAdmin={viewer.isAdmin}
            userId={viewer.user.id}
            allowedClassrooms={
              viewer.isAdmin ? POST_CLASSROOMS : [...viewer.teacherClassrooms, 'LEESKLAS']
            }
          />
        ) : null}

        {tab === 'Inhoud' && viewer.isAdmin ? <ContentTab /> : null}
      </main>

      <SiteFooter />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function MembersTab({ search, viewerId }: { search: string; viewerId: string }) {
  const [admins, teachers, results, total] = await Promise.all([
    listAdmins(),
    listTeachers(),
    searchUsers(search, 60),
    countUsers(),
  ]);

  const toRow = (user: (typeof admins)[number]): AdminUserRow => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    surname: user.surname,
    admin: user.admin,
    teacher: user.teacher,
    teacherClassroom: user.teacherClassroom,
    onLegacyPassword: user.onLegacyPassword,
  });

  const legacyCount = results.filter((user) => user.onLegacyPassword).length;

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Leden met onbeperkte rechten</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Administrators kunnen alles beheren. Houd dit lijstje kort.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {admins.map((user) => (
              <UserRightsRow key={user.id} user={toRow(user)} isSelf={user.id === viewerId} />
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Leerkrachten</h2>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              Er zijn nog geen leerkrachten aangesteld. Zoek hieronder een gebruiker en wijs rechten toe.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {teachers.map((user) => (
                <UserRightsRow key={user.id} user={toRow(user)} isSelf={user.id === viewerId} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Alle profielen</h2>
          <p className="text-sm text-ink-muted">{total} profielen in totaal</p>
        </div>

        {/* A plain GET form, so a search is a shareable URL and works without JS. */}
        <form action="/admin" method="get" className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="tab" value="Leden" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Zoek op naam of email"
            aria-label="Zoek op naam of email"
            className="min-w-60 flex-1 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-soft"
          >
            Zoeken
          </button>
        </form>

        {legacyCount > 0 ? (
          <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-muted">
            {legacyCount} van de {results.length} weergegeven profielen heeft sinds de overstap naar het
            nieuwe systeem nog niet ingelogd. Hun oude wachtwoord blijft geldig.
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-line">
          {results.map((user) => (
            <UserRightsRow key={user.id} user={toRow(user)} isSelf={user.id === viewerId} />
          ))}
        </ul>
      </Card>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function SimpleOrdersTab({ type }: { type: OrderType }) {
  const [toDistribute, toInvoice, totals] = await Promise.all([
    listOrders({ type, status: 'Besteld', limit: 500 }),
    listOrders({ type, status: 'Uitgedeeld', limit: 500 }),
    orderTotalsByClassroom(type, 'Besteld'),
  ]);

  return (
    <Section
      title={type === 'Gym T-shirt' ? 'Gym T-shirts' : `${type}en`}
      intro={`Overzicht van alle bestellingen van ${
        type === 'Gym T-shirt' ? 'gym T-shirts' : `${type.toLowerCase()}en`
      }. Download de lijst om uit te delen, en factureer daarna in één beweging.`}
    >
      <div className="flex flex-wrap gap-3">
        <a
          href={`/admin/export?type=${encodeURIComponent(type)}&status=Besteld`}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-soft"
        >
          Uit te delen downloaden
        </a>
        <a
          href={`/admin/export?type=${encodeURIComponent(type)}`}
          className="rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary hover:text-white"
        >
          Alle bestellingen downloaden
        </a>
        <BulkStatusForm
          orderType={type}
          from="Besteld"
          to="Uitgedeeld"
          label="Bestellingen factureren"
          confirmMessage="Ben je zeker dat je de status van alle bestellingen wil veranderen van “uit te delen” naar “uitgedeeld”?"
        />
      </div>

      {totals.length > 0 ? (
        <Card className="mt-6">
          <h3 className="font-display text-base font-semibold">Uit te delen per klas</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {totals.map((row) => (
              <li key={row.classroom ?? 'onbekend'} className="rounded-lg bg-canvas px-3 py-2 text-sm">
                <span className="font-medium">{row.classroom ?? 'Onbekend'}</span>
                <span className="text-ink-muted">
                  {' '}
                  — {row.orderCount} bestelling(en), {row.quantity} stuk(s)
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-3">
            <ResyncClassroomsButton />
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <OrderList title={`Uit te delen (${toDistribute.length})`} orders={toDistribute} canToggle />
        <OrderList title={`Te factureren (${toInvoice.length})`} orders={toInvoice} canToggle />
      </div>
    </Section>
  );
}

async function MealsTab() {
  const content = await getContent();
  const month = content.maaltijdMaand;

  const [open, closed] = await Promise.all([
    listOrders({ type: 'Maaltijd', status: 'Besteld', consumptionMonth: month ?? undefined, limit: 500 }),
    listOrders({
      type: 'Maaltijd',
      status: ['Uitgedeeld', 'Gefactureerd'],
      consumptionMonth: month ?? undefined,
      limit: 500,
    }),
  ]);

  // Per-date totals are what the kitchen actually needs.
  const perDate = new Map<string, number>();
  for (const order of open) {
    for (const date of order.consumptionDates) {
      perDate.set(date, (perDate.get(date) ?? 0) + 1);
    }
  }

  return (
    <Section
      title="Maaltijden"
      intro="Stel in welke maand en welke datums open staan voor bestellingen, laad het maandmenu op en download de lijst voor de keuken."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <h3 className="font-display text-base font-semibold">Bestelperiode</h3>
          <div className="mt-4">
            <MealAdminPanel
              month={content.maaltijdMaand}
              openDates={content.maaltijdDatums}
              menus={content.maaltijd}
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="font-display text-base font-semibold">Aantallen per datum</h3>
            {perDate.size === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Er zijn nog geen open bestellingen.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {[...perDate.entries()]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, count]) => (
                    <li key={date} className="flex justify-between rounded-lg bg-canvas px-3 py-2">
                      <span>{date}</span>
                      <span className="font-medium">{count} maaltijd(en)</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="font-display text-base font-semibold">Downloaden en afsluiten</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href={`/admin/export?type=Maaltijd${month ? `&month=${encodeURIComponent(month)}` : ''}`}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-soft"
              >
                Bestellingen downloaden
              </a>
              <BulkStatusForm
                orderType="Maaltijd"
                from="Besteld"
                to="Uitgedeeld"
                consumptionMonth={month}
                label="Bestellingen bevriezen"
                confirmMessage="Ben je zeker dat je alle bestellingen van deze maand wil bevriezen? Ouders kunnen ze daarna niet meer aanpassen."
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <OrderList title={`Open bestellingen (${open.length})`} orders={open} canToggle />
        <OrderList title={`Bevroren / gefactureerd (${closed.length})`} orders={closed} canToggle />
      </div>
    </Section>
  );
}

async function TeacherOrdersTab({ classrooms }: { classrooms: string[] }) {
  if (classrooms.length === 0) {
    return (
      <Section>
        <Card>
          <p className="text-[15px] text-ink-muted">
            Er is nog geen klas aan je profiel gekoppeld. Vraag een administrator om je klas in te stellen.
          </p>
        </Card>
      </Section>
    );
  }

  const [drinks, meals, caps, shirts] = await Promise.all([
    listOrders({ type: 'Drankkaart', status: 'Besteld', classrooms, limit: 300 }),
    listOrders({ type: 'Maaltijd', status: ['Besteld', 'Uitgedeeld'], classrooms, limit: 300 }),
    listOrders({ type: 'Badmuts', status: 'Besteld', classrooms, limit: 300 }),
    listOrders({ type: 'Gym T-shirt', status: 'Besteld', classrooms, limit: 300 }),
  ]);

  return (
    <Section
      title="Bestellingen voor mijn klas"
      intro={`Overzicht van alle openstaande bestellingen voor ${classrooms.join(', ')}.`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <OrderList title={`Uit te delen drankkaarten (${drinks.length})`} orders={drinks} canToggle />
        <OrderList title={`Warme maaltijden (${meals.length})`} orders={meals} canToggle />
        <OrderList title={`Badmutsen (${caps.length})`} orders={caps} canToggle />
        <OrderList title={`Gym T-shirts (${shirts.length})`} orders={shirts} canToggle />
      </div>
    </Section>
  );
}

function OrderList({
  title,
  orders,
  canToggle,
}: {
  title: string;
  orders: Order[];
  canToggle: boolean;
}) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Geen bestellingen in deze lijst.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">
                  {order.createdForName} {order.createdForSurname}
                  <span className="text-ink-muted"> · {order.createdForClassroom}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {order.quantity}× {order.orderType}
                  {order.color ? ` · ${order.color}` : ''}
                  {order.size ? ` · maat ${order.size}` : ''}
                  {order.consumptionDates.length > 0 ? ` · ${order.consumptionDates.join(', ')}` : ''}
                </p>
                <p className="text-xs text-ink-muted">
                  Besteld door {order.createdByName} {order.createdBySurname}
                  {order.createdByEmail ? ` (${order.createdByEmail})` : ''}
                </p>
              </div>
              {canToggle ? (
                <OrderStatusToggle
                  orderId={order.id}
                  status={order.status as 'Besteld' | 'Uitgedeeld' | 'Gefactureerd'}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function SchoolkrantTab({
  isAdmin,
  userId,
  allowedClassrooms,
}: {
  isAdmin: boolean;
  userId: string;
  allowedClassrooms: readonly string[];
}) {
  const posts = await listPosts({ limit: 60, viewerId: userId });
  const mine = isAdmin ? posts : posts.filter((post) => post.classroom.some((c) => allowedClassrooms.includes(c)));

  return (
    <Section title="Schoolkrant" intro="Schrijf en beheer de artikels van de schoolkrant.">
      <Card>
        <h3 className="font-display text-lg font-semibold">Nieuw artikel</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Schrijf een nieuw artikel voor de schoolkrant. Duid minstens één klas aan.
        </p>
        <div className="mt-5">
          <PostEditor allowedClassrooms={allowedClassrooms} />
        </div>
      </Card>

      <h3 className="mt-8 mb-3 font-display text-lg font-semibold">
        Bestaande artikels ({mine.length})
      </h3>
      {mine.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">Er zijn nog geen artikels.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {mine.map((post) => (
            <PostAdminRow
              key={post.id}
              allowedClassrooms={allowedClassrooms}
              post={{
                id: post.id,
                postTitle: post.postTitle,
                postDescription: post.postDescription,
                postPhoto: post.postPhoto,
                albumUrl: post.albumUrl,
                externalUrl: post.externalUrl,
                classroom: post.classroom,
                pinned: post.pinned,
                timePosted: post.timePosted.toISOString(),
                authorName: post.authorName,
              }}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function ContentTab() {
  const content = await getContent();

  const groups: Array<{ title: string; fields: Array<keyof typeof CONTENT_FIELDS> }> = [
    { title: 'Startpagina en inschrijvingen', fields: ['welkom', 'inschrijvingen', 'schoolreglement'] },
    {
      title: 'Schoolteam',
      fields: [
        'teamFoto',
        'teamDirecteur',
        'teamAdministratie',
        'teamKleuterschool',
        'teamLagereSchool',
        'teamAmbulant',
        'teamZorg',
        'teamGym',
        'teamOnderhoud',
      ],
    },
    { title: 'Schoolbestuur', fields: ['bestuurVoorzitter', 'bestuurLeden'] },
    { title: 'CLB', fields: ['clbCoordinator', 'clbMedewerkers'] },
    {
      title: 'Ondersteuningsnetwerk en opvang',
      fields: ['ondersteuningVestiging', 'ondersteuningVoorwaarden', 'opvang'],
    },
    { title: 'Gezondheid', fields: ['ziekte'] },
    { title: 'Maaltijden', fields: ['maaltijdMaand', 'maaltijdBericht'] },
    {
      title: 'Benodigdheden per klas',
      fields: [
        'benodigdhedenKK0',
        'benodigdhedenKK1',
        'benodigdhedenKK2',
        'benodigdhedenKK3',
        'benodigdhedenL1',
        'benodigdhedenL2',
        'benodigdhedenL3',
        'benodigdhedenL4',
        'benodigdhedenL5',
        'benodigdhedenL6',
      ],
    },
  ];

  return (
    <Section
      title="Inhoud van de website"
      intro="Deze teksten verschijnen rechtstreeks op de website. Regeleindes worden bewaard zoals je ze typt."
    >
      <p className="mb-6 text-sm text-ink-muted">
        Laatst aangepast:{' '}
        {new Intl.DateTimeFormat('nl-BE', {
          timeZone: 'Europe/Brussels',
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(content.updatedAt)}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <ContentGroupForm
            key={group.title}
            title={group.title}
            fields={group.fields.map((name) => ({
              name,
              label: CONTENT_FIELDS[name].label,
              multiline: CONTENT_FIELDS[name].multiline,
              value: (content[name] as string | null) ?? '',
            }))}
          />
        ))}
      </div>

      <Card className="mt-6">
        <h3 className="font-display text-base font-semibold">Klassen</h3>
        <p className="mt-1 text-sm text-ink-muted">
          De klassen die de website kent: {CLASSROOMS.join(', ')}. Artikels kunnen daarnaast ook voor
          LEESKLAS gepubliceerd worden.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Wil je een klas toevoegen of hernoemen? Dat staat in{' '}
          <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">db/schema.ts</code> en vereist een
          aanpassing door een ontwikkelaar, zodat bestaande bestellingen en kinderen niet stilletjes
          verkeerd gekoppeld raken.
        </p>
        <Link
          href="/schoolkrant"
          className="mt-4 inline-block text-sm text-primary underline-offset-2 hover:underline"
        >
          Bekijk de schoolkrant zoals ouders hem zien
        </Link>
      </Card>
    </Section>
  );
}
