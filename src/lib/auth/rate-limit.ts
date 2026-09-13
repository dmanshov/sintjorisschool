import { randomBytes } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loginAttempts } from '@db/schema';

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 10;
const MAX_FAILURES_PER_IP = 30;

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

async function countFailures(bucket: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.bucket, bucket),
        eq(loginAttempts.succeeded, false),
        gte(loginAttempts.attemptedAt, windowStart()),
      ),
    );
  return rows[0]?.count ?? 0;
}

export type RateLimitVerdict = { allowed: true } | { allowed: false; minutes: number };

/**
 * Two buckets: the email being targeted, and the IP doing the targeting. The
 * email bucket stops someone grinding one parent's password; the IP bucket stops
 * someone spraying one password across every parent.
 */
export async function checkLoginRate(email: string, ip: string | null): Promise<RateLimitVerdict> {
  const [emailFailures, ipFailures] = await Promise.all([
    countFailures(`email:${email.toLowerCase()}`),
    ip ? countFailures(`ip:${ip}`) : Promise.resolve(0),
  ]);

  if (emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP) {
    return { allowed: false, minutes: WINDOW_MINUTES };
  }
  return { allowed: true };
}

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  succeeded: boolean,
): Promise<void> {
  const rows = [
    { id: randomBytes(12).toString('hex'), bucket: `email:${email.toLowerCase()}`, succeeded },
    ...(ip ? [{ id: randomBytes(12).toString('hex'), bucket: `ip:${ip}`, succeeded }] : []),
  ];
  await db.insert(loginAttempts).values(rows);

  // Opportunistic cleanup: roughly one run in twenty keeps the table small
  // without a cron job.
  if (Math.random() < 0.05) {
    await db
      .delete(loginAttempts)
      .where(sql`${loginAttempts.attemptedAt} < now() - interval '1 day'`);
  }
}
