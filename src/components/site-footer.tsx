import Image from 'next/image';
import Link from 'next/link';
import { mainNav, school } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-primary text-white/90">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold text-white">{school.name}</p>
          <address className="mt-2 not-italic text-sm leading-relaxed">
            {school.address.street}
            <br />
            {school.address.postalCode} {school.address.city}
            <br />
            <a href={`tel:${school.phone.tel}`} className="underline-offset-2 hover:underline">
              {school.phone.display}
            </a>
            <br />
            <a href={`mailto:${school.email.general}`} className="underline-offset-2 hover:underline">
              {school.email.general}
            </a>
          </address>
        </div>

        <nav aria-label="Footernavigatie">
          <p className="font-display text-sm font-semibold tracking-wide text-white uppercase">Snel naar</p>
          <ul className="mt-2 space-y-1 text-sm">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline-offset-2 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/inschrijven" className="underline-offset-2 hover:underline">
                Inschrijven
              </Link>
            </li>
            <li>
              <Link href="/meldpunt" className="underline-offset-2 hover:underline">
                Meldpunt klokkenluiders
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="font-display text-sm font-semibold tracking-wide text-white uppercase">Volg en steun ons</p>
          <div className="mt-3 flex items-center gap-4">
            <a
              href={school.links.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline-offset-2 hover:underline"
            >
              Facebook
            </a>
            <a
              href={school.links.trooper}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Steun ons via Trooper"
            >
              <Image
                src="/images/Trooper.gif"
                alt="Trooper"
                width={96}
                height={32}
                unoptimized
                className="h-8 w-auto rounded bg-white/90 p-1"
              />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 px-4 py-4 text-center text-xs text-white/70 sm:px-6">
        <a
          href={school.links.builtBy}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Mogelijk gemaakt door Adappteez
        </a>
      </div>
    </footer>
  );
}
