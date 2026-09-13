import Image from 'next/image';
import Link from 'next/link';

/** Page title band, matching the sticky header the old pages had. */
export function PageHeader({
  title,
  intro,
  image,
}: {
  title: string;
  intro?: string;
  image?: { src: string; alt: string };
}) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <div className="grid items-center gap-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
            {intro ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">{intro}</p> : null}
          </div>
          {image ? (
            <Image
              src={image.src}
              alt={image.alt}
              width={640}
              height={420}
              className="h-48 w-full rounded-card object-cover shadow-card md:h-60"
              priority
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Section({
  id,
  title,
  intro,
  children,
  className = '',
}: {
  id?: string;
  title?: string;
  intro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 ${className}`}>
      {title ? <h2 className="font-display text-2xl font-semibold md:text-3xl">{title}</h2> : null}
      {intro ? <p className="mt-2 max-w-3xl leading-relaxed text-ink-muted">{intro}</p> : null}
      {title || intro ? <div className="mt-6">{children}</div> : children}
    </section>
  );
}

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li';
}) {
  return <Tag className={`card p-5 sm:p-6 ${className}`}>{children}</Tag>;
}

/**
 * Tab strip. The old app kept the selected tab in app state and in a
 * `navParameter` query string; both spellings still work, and the tab is now a
 * real link, so a parent can bookmark "Praktisch → Bestellingen".
 */
export function TabNav({
  tabs,
  active,
  basePath,
}: {
  tabs: ReadonlyArray<{ key: string; label: string }>;
  active: string;
  basePath: string;
}) {
  return (
    <nav aria-label="Onderdelen" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={`${basePath}?tab=${tab.key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-ink-muted hover:border-line hover:text-primary'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Collapsible block, using <details> so it works without JavaScript. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="card group overflow-hidden p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-display text-lg font-medium text-primary sm:p-6">
        {summary}
        <svg
          className="shrink-0 transition-transform group-open:rotate-180"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="border-t border-line p-5 sm:p-6">{children}</div>
    </details>
  );
}

/** A link that opens a PDF, labelled so its purpose is obvious out of context. */
export function DocumentLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M14 3v5h5M6 3h9l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {label}
      <span className="sr-only"> (opent in een nieuw venster)</span>
    </a>
  );
}

/** CMS text rendered as typed, or a quiet placeholder when the field is empty. */
export function CmsText({ value, fallback }: { value: string | null; fallback?: string }) {
  if (!value || value.trim().length === 0) {
    return fallback ? <p className="text-sm text-ink-muted italic">{fallback}</p> : null;
  }
  return <div className="prose-cms text-[15px] text-ink">{value}</div>;
}
