import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classifyDbError } from '@/lib/db-status';

export const dynamic = 'force-dynamic';

/**
 * Honest deployment check. Answers the three questions you actually have after a
 * deploy: is the app up, can it reach its database, and has the schema been
 * applied.
 *
 * Deliberately says nothing about *which* database — no host, no credentials, no
 * row contents — so it is safe to leave public and to point uptime monitoring at.
 */
export async function GET() {
  const started = Date.now();

  try {
    const result = await db.execute(
      sql`select (select count(*) from content)::int as content_rows`,
    );
    const rows = result.rows as Array<{ content_rows: number }>;

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        schema: 'present',
        contentRows: rows[0]?.content_rows ?? 0,
        latencyMs: Date.now() - started,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const failure = classifyDbError(error);
    console.error('[health] database check failed', error);

    if (failure === 'not-initialised') {
      return NextResponse.json(
        {
          status: 'setup-required',
          database: 'connected',
          schema: 'missing',
          hint: 'Run "npm run db:apply" against this environment database.',
          latencyMs: Date.now() - started,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unreachable',
        hint: 'Check DATABASE_URL for this environment.',
        latencyMs: Date.now() - started,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
