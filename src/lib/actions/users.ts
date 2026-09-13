'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { countAdmins } from '@/lib/data/users';
import { destroyAllSessionsFor } from '@/lib/auth/session';
import { CLASSROOMS, users } from '@db/schema';

export type ActionState = { error?: string; success?: string } | null;

/**
 * Grant or revoke admin and teacher rights.
 *
 * The "never remove the last admin" rule was enforced in the old app by a
 * client-side count, which a second tab or a direct Firestore write went
 * straight past. Here it is a server-side check inside the same request that
 * performs the write.
 */
export async function updateUserRightsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const admin = formData.get('admin') === 'on';
  const teacher = formData.get('teacher') === 'on';
  const teacherClassroom = formData
    .getAll('teacherClassroom')
    .map(String)
    .filter((c) => (CLASSROOMS as readonly string[]).includes(c));

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) return { error: 'Deze gebruiker werd niet gevonden.' };

  if (teacher && teacherClassroom.length === 0) {
    return { error: 'Gelieve een klas te kiezen voor deze leerkracht.' };
  }

  if (target.admin && !admin) {
    const remaining = await countAdmins();
    if (remaining <= 1) {
      return {
        error:
          'Er moet minstens 1 administrator overblijven. Voeg eerst een vervangende administrator toe.',
      };
    }
    if (target.id === actor.id) {
      // Allowed, but worth being explicit about: an admin demoting themselves
      // immediately loses access to this screen.
      // Falls through on purpose.
    }
  }

  await db
    .update(users)
    .set({
      admin,
      teacher,
      teacherClassroom: teacher ? teacherClassroom : [],
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath('/admin');
  return { success: 'De aanpassingen werden opgeslagen.' };
}

/**
 * Blocks an account without deleting it, so the family's order history and the
 * link to their children survive. Also kills their live sessions.
 */
export async function setUserDisabledAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const disabled = formData.get('disabled') === 'true';

  if (userId === actor.id) return { error: 'Je kan je eigen profiel niet blokkeren.' };

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) return { error: 'Deze gebruiker werd niet gevonden.' };

  if (disabled && target.admin) {
    const remaining = await countAdmins();
    if (remaining <= 1) {
      return { error: 'Er moet minstens 1 actieve administrator overblijven.' };
    }
  }

  await db.update(users).set({ disabled, updatedAt: new Date() }).where(eq(users.id, userId));
  if (disabled) await destroyAllSessionsFor(userId);

  revalidatePath('/admin');
  return { success: disabled ? 'Het profiel werd geblokkeerd.' : 'Het profiel werd opnieuw geactiveerd.' };
}

/**
 * Report on how far the password migration has got: how many accounts still
 * carry a Firebase hash because their owner has not logged in since the switch.
 * Useful for deciding when the FIREBASE_HASH_* variables can be removed.
 */
export async function legacyPasswordStats(): Promise<{
  total: number;
  legacy: number;
  migrated: number;
  noPassword: number;
}> {
  await requireAdmin();
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      legacy: sql<number>`count(*) filter (where ${users.legacyFirebaseHash} is not null)::int`,
      migrated: sql<number>`count(*) filter (where ${users.passwordHash} is not null)::int`,
      noPassword: sql<number>`count(*) filter (where ${users.passwordHash} is null and ${users.legacyFirebaseHash} is null)::int`,
    })
    .from(users);
  return rows[0] ?? { total: 0, legacy: 0, migrated: 0, noPassword: 0 };
}
