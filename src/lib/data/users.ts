import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, type User } from '@db/schema';

export type UserSummary = {
  id: string;
  email: string;
  displayName: string | null;
  surname: string | null;
  admin: boolean;
  teacher: boolean;
  teacherClassroom: string[];
  createdTime: Date;
  lastLoginAt: Date | null;
  /** True while this account still has a Firebase hash and has not logged in yet. */
  onLegacyPassword: boolean;
};

const summary = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  surname: users.surname,
  admin: users.admin,
  teacher: users.teacher,
  teacherClassroom: users.teacherClassroom,
  createdTime: users.createdTime,
  lastLoginAt: users.lastLoginAt,
  onLegacyPassword: sql<boolean>`${users.legacyFirebaseHash} is not null`,
};

export async function listAdmins(): Promise<UserSummary[]> {
  return db.select(summary).from(users).where(eq(users.admin, true)).orderBy(asc(users.email));
}

export async function listTeachers(): Promise<UserSummary[]> {
  return db.select(summary).from(users).where(eq(users.teacher, true)).orderBy(asc(users.email));
}

export async function countAdmins(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.admin, true));
  return rows[0]?.count ?? 0;
}

/**
 * Account search for the admin screen. Matches on email, first name and
 * surname. Runs in Postgres rather than shipping every account to the browser,
 * which is what the old `text_search` package did.
 */
export async function searchUsers(query: string, limit = 50): Promise<UserSummary[]> {
  const trimmed = query.trim();
  const base = db.select(summary).from(users);

  if (!trimmed) {
    return base.orderBy(desc(users.createdTime)).limit(limit);
  }

  const pattern = `%${trimmed.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  return base
    .where(
      sql`${users.email} ilike ${pattern}
        or coalesce(${users.displayName}, '') ilike ${pattern}
        or coalesce(${users.surname}, '') ilike ${pattern}`,
    )
    .orderBy(asc(users.surname), asc(users.displayName))
    .limit(limit);
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return rows[0]?.count ?? 0;
}

export async function getUser(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export function displayNameOf(user: {
  displayName: string | null;
  surname: string | null;
  email: string;
}): string {
  const full = [user.displayName, user.surname].filter(Boolean).join(' ').trim();
  return full || user.email;
}
