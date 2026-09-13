import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Card, DocumentLink, PageHeader, Section } from '@/components/layout';
import {
  AddChildForm,
  ChangePasswordForm,
  ChildListItem,
  ProfileDetailsForm,
} from '@/components/profile-forms';
import {
  MealOrderForm,
  OrderHistory,
  SimpleOrderForm,
  type ChildOption,
  type OrderRow,
} from '@/components/order-forms';
import { getCurrentUser } from '@/lib/auth/session';
import { listChildrenForParent } from '@/lib/data/children';
import { getContent } from '@/lib/data/content';
import { listOrders } from '@/lib/data/orders';
import { ordersCopy } from '@/lib/copy';
import { school, teacherContacts } from '@/lib/site';
import { ORDER_TYPES, type OrderType } from '@db/schema';

export const metadata: Metadata = {
  title: 'Mijn profiel',
  robots: { index: false, follow: false },
};

/** Never cached: this page is one family's private data. */
export const dynamic = 'force-dynamic';

export default async function ProfielPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profiel');

  const params = await searchParams;
  const justRegistered = params.welkom === '1';
  const passwordChanged = params.wachtwoord === '1';

  const [kids, content, recentOrders] = await Promise.all([
    listChildrenForParent(user.id),
    getContent(),
    listOrders({ createdById: user.id, limit: 60 }),
  ]);

  const childOptions: ChildOption[] = kids.map((child) => ({
    id: child.id,
    name: child.name,
    surname: child.surname,
    classroom: child.classroom,
  }));

  const ordersByType = new Map<OrderType, OrderRow[]>();
  for (const type of ORDER_TYPES) ordersByType.set(type, []);
  for (const order of recentOrders) {
    const bucket = ordersByType.get(order.orderType as OrderType);
    if (!bucket || bucket.length >= 5) continue;
    bucket.push({
      id: order.id,
      orderType: order.orderType,
      status: order.status,
      quantity: order.quantity,
      color: order.color,
      size: order.size,
      consumptionMonth: order.consumptionMonth,
      consumptionDates: order.consumptionDates,
      createdForName: order.createdForName,
      createdAt: order.createdAt.toISOString(),
    });
  }

  const hasChildren = kids.length > 0;
  const menuUrl = content.maaltijd.at(-1) ?? null;

  return (
    <>
      <SiteHeader />

      <main id="inhoud">
        <PageHeader
          title="Mijn profiel"
          intro="Voeg gezinsleden toe, beheer je persoonlijke gegevens en plaats bestellingen."
        />

        <Section>
          {justRegistered ? (
            <Card className="mb-6 border-l-4 border-success">
              <p className="text-[15px]">
                <strong>Gelukt!</strong> Je profiel werd aangemaakt voor {user.email}. Voeg je kinderen
                toe om van alle functies te genieten.
              </p>
            </Card>
          ) : null}

          {passwordChanged ? (
            <Card className="mb-6 border-l-4 border-success">
              <p className="text-[15px]">Je nieuwe wachtwoord is ingesteld. Welkom terug.</p>
            </Card>
          ) : null}

          <div className="space-y-6">
            <ProfileDetailsForm
              displayName={user.displayName ?? ''}
              surname={user.surname ?? ''}
              phoneNumber={user.phoneNumber ?? ''}
              email={user.email}
            />

            <AddChildForm />

            {hasChildren ? (
              <div>
                <h2 className="mb-3 font-display text-xl font-semibold">Jouw gezinsleden</h2>
                <ul className="space-y-3">
                  {kids.map((child) => (
                    <ChildListItem key={child.id} child={child} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Bestellingen" className="pt-0">
          {!hasChildren ? (
            <Card>
              <p className="text-[15px] text-ink-muted">
                Gelieve eerst kinderen toe te voegen in je profiel. Daarna kan je drankkaarten,
                badmutsen, gym T-shirts en warme maaltijden bestellen.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {(['Drankkaart', 'Badmuts', 'Gym T-shirt'] as const).map((type) => (
                <Card key={type}>
                  <h3 className="font-display text-lg font-semibold">{ordersCopy[type].title}</h3>
                  <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
                    {ordersCopy[type].long}
                  </p>

                  <div className="mt-5">
                    <SimpleOrderForm orderType={type} childOptions={childOptions} />
                  </div>

                  <div className="mt-6 border-t border-line pt-4">
                    <h4 className="text-sm font-semibold">Jouw laatste 5 bestellingen</h4>
                    <div className="mt-1">
                      <OrderHistory orders={ordersByType.get(type) ?? []} />
                    </div>
                  </div>
                </Card>
              ))}

              <Card>
                <h3 className="font-display text-lg font-semibold">{ordersCopy.Maaltijd.title}</h3>
                <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
                  {content.maaltijdBericht?.trim() || ordersCopy.Maaltijd.long}
                </p>
                {menuUrl ? (
                  <div className="mt-4">
                    <DocumentLink href={menuUrl} label="Bekijk het huidige menu" />
                  </div>
                ) : null}

                <div className="mt-5">
                  <MealOrderForm
                    childOptions={childOptions}
                    openDates={content.maaltijdDatums}
                    month={content.maaltijdMaand}
                  />
                </div>

                <div className="mt-6 border-t border-line pt-4">
                  <h4 className="text-sm font-semibold">Jouw laatste 5 bestellingen</h4>
                  <div className="mt-1">
                    <OrderHistory
                      orders={ordersByType.get('Maaltijd') ?? []}
                      openDates={content.maaltijdDatums}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}
        </Section>

        <Section title="Leerkrachten" intro="De email adressen van het schoolteam, op één plek." className="pt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {[teacherContacts.kleuterschool, teacherContacts.lagereSchool].map((section) => (
              <Card key={section.title}>
                <h3 className="font-display text-lg font-semibold">{section.title}</h3>
                {section.groups.map((group) => (
                  <div key={group.label} className="mt-4">
                    <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      {group.label}
                    </h4>
                    <ul className="mt-2 divide-y divide-line">
                      {group.people.map((person) => (
                        <li key={`${group.label}-${person.email}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
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

        <Section className="pt-0">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChangePasswordForm />

            <Card>
              <h2 className="font-display text-xl font-semibold">Meldingen</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                Weet je of vermoed je dat bepaalde regelgeving niet correct wordt nageleefd? Dan kan je dit
                melden door contact op te nemen met ons intern meldpunt voor klokkenluiders.
              </p>
              <Link
                href="/meldpunt"
                className="mt-4 inline-block rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Meer informatie
              </Link>

              <h3 className="mt-8 font-display text-base font-semibold">Oudercontact</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Er zijn momenteel geen oudercontacten actief voor inschrijving.
              </p>

              <p className="mt-8 text-sm text-ink-muted">
                Vragen over je profiel of je gegevens?{' '}
                <a
                  href={`mailto:${school.email.general}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {school.email.general}
                </a>
              </p>
            </Card>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
