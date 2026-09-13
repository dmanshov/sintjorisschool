'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/lib/auth/actions';
import { mainNav, school } from '@/lib/site';

export function MobileNav({
  loggedIn,
  isStaff,
  current,
}: {
  loggedIn: boolean;
  isStaff: boolean;
  current?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes the drawer, and focus moves into it when it opens, so it is
  // operable without a mouse.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Menu openen"
        className="rounded-lg p-2 text-primary transition-colors hover:bg-canvas"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Menu sluiten"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigatie"
            className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="font-display text-lg font-semibold text-primary">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menu sluiten"
                className="rounded-lg p-2 text-ink-muted hover:bg-canvas"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {!loggedIn ? (
              <p className="border-b border-line bg-canvas px-5 py-3 text-sm text-ink-muted">
                Meld je aan voor extra functies
              </p>
            ) : null}

            <nav className="flex flex-col px-2 py-2">
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={current === item.href ? 'page' : undefined}
                  className={`rounded-lg px-3 py-3 text-base ${
                    current === item.href
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-ink hover:bg-canvas'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-line px-2 py-2">
              {loggedIn ? (
                <>
                  <Link
                    href="/profiel"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base text-ink hover:bg-canvas"
                  >
                    Mijn profiel
                  </Link>
                  {isStaff ? (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-3 text-base text-ink hover:bg-canvas"
                    >
                      Administratie
                    </Link>
                  ) : null}
                  <Link
                    href="/meldpunt"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base text-ink hover:bg-canvas"
                  >
                    Meldpunt
                  </Link>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="w-full rounded-lg px-3 py-3 text-left text-base text-ink hover:bg-canvas"
                    >
                      Afmelden
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg bg-primary px-3 py-3 text-center text-base font-medium text-white"
                >
                  Aanmelden
                </Link>
              )}

              <a
                href={school.links.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-3 py-3 text-base text-ink-muted hover:bg-canvas"
              >
                Volg ons op Facebook
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
