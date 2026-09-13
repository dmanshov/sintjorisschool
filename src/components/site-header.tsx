import Image from 'next/image';
import Link from 'next/link';
import { logoutAction } from '@/lib/auth/actions';
import { getViewer } from '@/lib/auth/session';
import { mainNav, school } from '@/lib/site';
import { MobileNav } from './mobile-nav';

export async function SiteHeader({ current }: { current?: string }) {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={`${school.name}, naar de startpagina`}>
          <Image
            src="/images/draak_klein_transparant.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            priority
          />
          <span className="hidden font-display text-lg leading-tight font-semibold text-primary sm:block">
            Sint-Jorisschool
          </span>
        </Link>

        <nav aria-label="Hoofdnavigatie" className="ml-auto hidden items-center gap-1 lg:flex">
          {mainNav.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-ink-muted hover:bg-canvas hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          {viewer ? (
            <>
              {viewer.isAdmin || viewer.isTeacher ? (
                <Link
                  href="/admin"
                  className="hidden rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white lg:block"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                href="/profiel"
                className="hidden rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-soft lg:block"
              >
                Mijn profiel
              </Link>
              <form action={logoutAction} className="hidden lg:block">
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:text-primary"
                >
                  Afmelden
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-soft lg:block"
            >
              Aanmelden
            </Link>
          )}

          <MobileNav
            loggedIn={Boolean(viewer)}
            isStaff={Boolean(viewer?.isAdmin || viewer?.isTeacher)}
            current={current}
          />
        </div>
      </div>
    </header>
  );
}
