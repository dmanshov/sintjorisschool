import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LoginRegisterTabs } from '@/components/auth-forms';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Aanmelden',
  description: 'Meld je aan op je profiel van de Sint-Jorisschool.',
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/profiel');

  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  return (
    <>
      <SiteHeader />

      <main id="inhoud" className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 md:py-20">
        <h1 className="mb-2 font-display text-3xl font-semibold">Mijn profiel</h1>
        <p className="mb-8 text-[15px] text-ink-muted">
          Meld je aan om bestellingen te plaatsen, je gezinsleden te beheren en de schoolkrant van je
          eigen klassen te volgen.
        </p>

        <LoginRegisterTabs next={next} />
      </main>

      <SiteFooter />
    </>
  );
}
