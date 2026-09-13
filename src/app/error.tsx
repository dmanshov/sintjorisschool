'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the host's logs. The message itself is never shown to a visitor:
    // it can carry internal detail.
    console.error(error);
  }, [error]);

  return (
    <main id="inhoud" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-24">
      <h1 className="font-display text-3xl font-semibold text-primary">Er ging iets mis</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
        Probeer het opnieuw. Blijft het misgaan, laat het ons dan weten via{' '}
        <a href="mailto:info@sintjorisschool.be" className="text-primary underline-offset-2 hover:underline">
          info@sintjorisschool.be
        </a>
        .
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
        >
          Opnieuw proberen
        </button>
        <Link
          href="/"
          className="rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary"
        >
          Naar de startpagina
        </Link>
      </div>
    </main>
  );
}
