import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ResetPasswordForm } from '@/components/auth-forms';
import { Card } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Nieuw wachtwoord',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = raw ?? '';

  return (
    <>
      <SiteHeader />
      <main id="inhoud" className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 md:py-20">
        <h1 className="mb-6 font-display text-3xl font-semibold">Kies een nieuw wachtwoord</h1>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Card>
            <p className="text-[15px]">
              Deze link is onvolledig. Vraag een{' '}
              <Link
                href="/wachtwoord-vergeten"
                className="text-primary underline-offset-2 hover:underline"
              >
                nieuw wachtwoord
              </Link>{' '}
              aan.
            </p>
          </Card>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
