import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ForgotPasswordForm } from '@/components/auth-forms';

export const metadata: Metadata = {
  title: 'Wachtwoord vergeten',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main id="inhoud" className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 md:py-20">
        <h1 className="mb-6 font-display text-3xl font-semibold">Wachtwoord vergeten</h1>
        <ForgotPasswordForm />
      </main>
      <SiteFooter />
    </>
  );
}
