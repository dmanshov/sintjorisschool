import { NextResponse, type NextRequest } from 'next/server';

/**
 * Staging lock.
 *
 * While `SITE_ACCESS_CODE` is set, the whole site sits behind an HTTP Basic
 * prompt and is marked `noindex`. Unset the variable and redeploy, and the site
 * is public — there is no second switch to remember.
 *
 * This exists because a Vercel *production* deployment is publicly reachable at
 * its `*.vercel.app` address even before a custom domain is attached, and unlike
 * preview deployments it is not automatically marked noindex. "Nobody knows the
 * URL" is not access control, and a search engine that finds it would both
 * expose the unfinished site and later compete with the school's real domain for
 * the same content.
 *
 * Not a substitute for the login on /profiel and /admin. That protects real
 * accounts and personal data and applies regardless. This only keeps the whole
 * site private while it is being finished.
 */
/**
 * ASCII only. HTTP header values are ByteStrings, so a non-Latin-1 character
 * here (an em dash, an accented vowel) throws inside the middleware and turns
 * every request into a 500 instead of a login prompt.
 */
const REALM = 'Sint-Jorisschool (site in opbouw)';

/** Reachable without the code, so a deploy can be checked without a browser. */
const OPEN_PATHS = ['/api/health'];

/**
 * Compares without returning early on the first differing byte, so the time
 * taken does not narrow down the code. Written against Web APIs because
 * middleware runs on the edge runtime, where node:crypto is unavailable.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function decodeBasicAuth(header: string | null): string | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice(6));
    // "user:password" — any username is accepted; only the password is checked,
    // so there is nothing extra for a tester to remember.
    const separator = decoded.indexOf(':');
    return separator === -1 ? decoded : decoded.slice(separator + 1);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const code = process.env.SITE_ACCESS_CODE;

  // No code configured: the site is public and this costs one comparison.
  if (!code) return NextResponse.next();

  if (OPEN_PATHS.some((path) => request.nextUrl.pathname === path)) {
    return NextResponse.next();
  }

  const supplied = decodeBasicAuth(request.headers.get('authorization'));

  if (supplied && constantTimeEqual(supplied, code)) {
    const response = NextResponse.next();
    // Belt and braces: even past the prompt, nothing here should be indexed.
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  return new NextResponse(
    'Deze website is nog in opbouw en momenteel niet publiek toegankelijk.',
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'Cache-Control': 'no-store',
      },
    },
  );
}

export const config = {
  /**
   * Everything, including static assets: a locked site that still served its
   * photos and PDFs would not be locked. The cost is one string comparison per
   * request, and none at all once SITE_ACCESS_CODE is removed.
   */
  matcher: ['/((?!_next/static/chunks).*)'],
};
