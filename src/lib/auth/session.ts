import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sessions, users, type User } from '@db/schema';

const COOKIE_NAME = 'sjs_session';
const SESSION_DAYS = 30;

/**
 * The cookie carries `<session id>.<HMAC(session id)>`. The id alone would be
 * enough (it is 256 bits of randomness checked against the sessions table), but
 * the HMAC lets an obviously forged cookie be rejected without touching the
 * database, which keeps a flood of junk cookies from becoming a flood of queries.
 */
function sign(id: string): string {
  return createHmac('sha256', env.sessionSecret).update(id).digest('base64url');
}

function parseCookieValue(value: string): string | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;
  const id = value.slice(0, separator);
  const providedSignature = Buffer.from(value.slice(separator + 1));
  const expectedSignature = Buffer.from(sign(id));
  if (providedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;
  return id;
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const id = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    userAgent: userAgent?.slice(0, 400) ?? null,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (raw) {
    const id = parseCookieValue(raw);
    if (id) await db.delete(sessions).where(eq(sessions.id, id));
  }
  store.delete(COOKIE_NAME);
}

/** Log a user out of every device. Used after a password reset. */
export async function destroyAllSessionsFor(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * The current user, or null. Wrapped in React's `cache` so that a page which
 * checks permissions in three components still makes one query per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const id = parseCookieValue(raw);
  if (!id) return null;

  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const user = rows[0]?.user ?? null;
  if (!user || user.disabled) return null;
  return user;
});

export type Viewer = {
  user: User;
  isAdmin: boolean;
  isTeacher: boolean;
  /** Classrooms this user may act on as a teacher. Admins get all of them. */
  teacherClassrooms: string[];
};

export async function getViewer(): Promise<Viewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    user,
    isAdmin: user.admin,
    isTeacher: user.teacher,
    teacherClassrooms: user.teacherClassroom ?? [],
  };
}

/**
 * Throws if there is no session. Every page and server action behind a login
 * calls this — authorisation lives on the server, not in whether a link is
 * rendered. That is the substantive difference from the old app, where the
 * Firestore rules allowed anyone to read and write everything and the only thing
 * standing in the way was the UI not showing a button.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Je moet aangemeld zijn om dit te doen.');
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.admin) throw new AuthError('Je hebt geen beheerdersrechten.');
  return user;
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!user.admin && !user.teacher) throw new AuthError('Je hebt hiervoor geen rechten.');
  return user;
}

export class AuthError extends Error {}

/** Housekeeping, called opportunistically from the login flow. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
