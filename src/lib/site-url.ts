import { headers } from 'next/headers';

/**
 * The origin this request actually arrived on — never a hardcoded domain.
 *
 * `NEXT_PUBLIC_SITE_URL` is an optional override, for the rare case where the
 * public-facing origin genuinely differs from what the server sees (behind a
 * CDN or proxy that does not forward the standard headers). Leave it unset and
 * this works correctly on every host without configuration: a Vercel preview
 * URL, the `*.vercel.app` production URL, a custom domain, or localhost — each
 * gets its own correct origin, because it is read from the request that is
 * actually being served, not assumed.
 *
 * This is what makes the codebase carry no reference to any particular domain.
 * Whichever domain ends up serving the site, this returns it — nothing here
 * needs to change when that domain does.
 *
 * Only callable from a request context (a Server Component, Server Action, or
 * Route Handler) — the same constraint `headers()` itself has.
 */
export async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const list = await headers();
  const proto = list.get('x-forwarded-proto') ?? 'https';
  const host = list.get('x-forwarded-host') ?? list.get('host');

  if (!host) {
    // No request to read from (e.g. called outside a request, or a host that
    // strips the Host header). There is no safe domain to guess, so this is a
    // configuration problem to surface rather than a default to paper over.
    throw new Error(
      'Could not determine the site origin: no Host header on the request and ' +
        'NEXT_PUBLIC_SITE_URL is not set.',
    );
  }

  return `${proto}://${host}`;
}
