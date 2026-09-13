'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { isParentOf } from '@/lib/data/children';
import { requireUser } from '@/lib/auth/session';
import { CLASSROOMS, childParents, children } from '@db/schema';

export type ActionState = { error?: string; success?: string } | null;

function validClassroom(value: unknown): value is (typeof CLASSROOMS)[number] {
  return typeof value === 'string' && (CLASSROOMS as readonly string[]).includes(value);
}

export async function addChildAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const classroom = formData.get('classroom');

  if (!name) return { error: 'Vul de voornaam van je kind in.' };
  if (!validClassroom(classroom)) return { error: 'Bevestig de klas van je kind.' };

  /**
   * If a sibling's other parent already registered this child, link to the
   * existing record instead of creating a duplicate. Firestore had no way to
   * express this, so families with two accounts ended up with two rows for the
   * same pupil and two sets of orders.
   */
  const existing = await db
    .select({ id: children.id })
    .from(children)
    .where(
      sql`lower(${children.name}) = ${name.toLowerCase()}
        and lower(${children.surname}) = ${surname.toLowerCase()}
        and ${children.classroom} = ${classroom}`,
    )
    .limit(1);

  const childId = existing[0]?.id ?? randomBytes(12).toString('hex');

  if (!existing[0]) {
    await db.insert(children).values({ id: childId, name, surname, classroom });
  }

  await db.insert(childParents).values({ childId, userId: user.id }).onConflictDoNothing();

  revalidatePath('/profiel');
  revalidatePath('/schoolkrant');
  return { success: `${name} werd met succes toegevoegd aan je gezin.` };
}

export async function updateChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const childId = String(formData.get('childId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const classroom = formData.get('classroom');

  // Authorisation on the server: being able to submit the form is not permission.
  if (!user.admin && !(await isParentOf(user.id, childId))) {
    return { error: 'Je kan enkel je eigen gezinsleden aanpassen.' };
  }
  if (!name) return { error: 'Vul de voornaam van je kind in.' };
  if (!validClassroom(classroom)) return { error: 'Bevestig de klas van je kind.' };

  await db
    .update(children)
    .set({ name, surname, classroom, updatedAt: new Date() })
    .where(eq(children.id, childId));

  revalidatePath('/profiel');
  return { success: 'De aanpassingen werden opgeslagen.' };
}

/**
 * Removes the child from *this* parent's family. The pupil record itself is only
 * deleted once no parent is linked to it any more, so one parent leaving does not
 * wipe the other parent's orders.
 */
export async function removeChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const childId = String(formData.get('childId') ?? '');

  if (!user.admin && !(await isParentOf(user.id, childId))) {
    return { error: 'Je kan enkel je eigen gezinsleden verwijderen.' };
  }

  await db
    .delete(childParents)
    .where(and(eq(childParents.childId, childId), eq(childParents.userId, user.id)));

  const remaining = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(childParents)
    .where(eq(childParents.childId, childId));

  if ((remaining[0]?.count ?? 0) === 0) {
    await db.delete(children).where(eq(children.id, childId));
  }

  revalidatePath('/profiel');
  return { success: 'Gezinslid werd verwijderd.' };
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const phoneNumber = String(formData.get('phoneNumber') ?? '').trim();

  const { users } = await import('@db/schema');
  await db
    .update(users)
    .set({
      displayName: displayName || null,
      surname: surname || null,
      phoneNumber: phoneNumber || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/profiel');
  return { success: 'Je profiel werd met succes aangepast.' };
}
