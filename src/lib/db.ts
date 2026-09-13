import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@db/schema';

/**
 * Database handle.
 *
 * Production runs on Neon, reached over HTTP: one round trip per query and no
 * connection to keep warm, which is what a serverless request handler wants.
 *
 * A plain `postgresql://localhost/...` string instead selects node-postgres, so
 * the site runs against a local Postgres for development and in CI without
 * needing a Neon branch. The query code is identical either way — that is the
 * point of going through Drizzle rather than writing driver-specific SQL.
 */
function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.neon.tech') || host.endsWith('.neon.build');
  } catch {
    return false;
  }
}

function createDb(): NeonHttpDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Neon connection string.',
    );
  }

  if (isNeonUrl(url)) {
    return drizzleNeon(neon(url), { schema, casing: 'snake_case' });
  }

  // Local / self-hosted Postgres. Required lazily so the Neon path never pulls
  // node-postgres into the serverless bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleNode } = require('drizzle-orm/node-postgres') as typeof import('drizzle-orm/node-postgres');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg');

  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: url.includes('sslmode=disable') ? false : undefined,
  });
  // The two drivers expose the same query builder; the cast keeps every call site
  // free of driver-specific branching.
  return drizzleNode(pool, { schema, casing: 'snake_case' }) as unknown as NeonHttpDatabase<
    typeof schema
  >;
}

/**
 * One handle per process. `globalThis` keeps it across hot reloads in dev, so a
 * long editing session does not leak a connection pool per save.
 */
const globalForDb = globalThis as unknown as { __sjsDb?: NeonHttpDatabase<typeof schema> };

function getRealDb(): NeonHttpDatabase<typeof schema> {
  globalForDb.__sjsDb ??= createDb();
  return globalForDb.__sjsDb;
}

/**
 * `db` is a Proxy, not the real Drizzle instance. Importing this module — which
 * happens for any route that touches auth, content, orders, posts or users —
 * must never construct a client or read `DATABASE_URL`.
 *
 * The reason that matters: Next builds every route module to collect its config
 * (`export const dynamic`, etc.) *before* any request exists, including for
 * routes with no reason to run at build time. A route that is merely reachable
 * through a shared import (the not-found page pulling in the header, which
 * checks the session, which imports `db`) used to crash the entire build the
 * moment `DATABASE_URL` was absent during that collection step — not merely
 * unreachable, genuinely unset, which every fresh Vercel project starts as.
 * `force-dynamic` on the pages does not prevent this: it stops Next from
 * *rendering* a page at build time, not from *importing* its module to read
 * that very export.
 *
 * The real client is constructed on first actual use — the first query a
 * request makes — at which point a missing `DATABASE_URL` is exactly what it
 * should be: a runtime error inside that one request, caught by `safeRead`
 * where reads can degrade, or surfaced as a real error where a write cannot.
 *
 * Every property access is bound to the real instance before being returned
 * (not accessed through the proxy afterwards), because Drizzle's methods rely
 * on internal state via `this` — calling one with the proxy itself as `this`
 * would reach the same values through this same trap, which is unnecessary
 * indirection at best and a correctness risk at worst. Verified against a real
 * database, not just against a build: see test/database.test.ts.
 */
export const db: NeonHttpDatabase<typeof schema> = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, _receiver) {
    const real = getRealDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getRealDb(), prop);
  },
});

export { schema };
