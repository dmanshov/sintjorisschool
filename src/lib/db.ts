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

export const db: NeonHttpDatabase<typeof schema> = globalForDb.__sjsDb ?? createDb();
if (process.env.NODE_ENV !== 'production') globalForDb.__sjsDb = db;

export { schema };
