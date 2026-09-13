import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { childParents, children, users } from '@db/schema';

export type ChildWithParents = {
  id: string;
  name: string;
  surname: string;
  classroom: string;
  parentIds: string[];
};

/** The children linked to one parent account. */
export async function listChildrenForParent(userId: string): Promise<ChildWithParents[]> {
  const rows = await db
    .select({
      id: children.id,
      name: children.name,
      surname: children.surname,
      classroom: children.classroom,
      parentIds: sql<string[]>`(
        select coalesce(array_agg(cp2.user_id), '{}')
        from child_parents cp2 where cp2.child_id = ${children.id}
      )`,
    })
    .from(children)
    .innerJoin(childParents, eq(childParents.childId, children.id))
    .where(eq(childParents.userId, userId))
    .orderBy(asc(children.name));
  return rows;
}

export async function countChildrenForParent(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(childParents)
    .where(eq(childParents.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Classrooms this parent has children in. Drives which articles they see. */
export async function classroomsForParent(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ classroom: children.classroom })
    .from(children)
    .innerJoin(childParents, eq(childParents.childId, children.id))
    .where(eq(childParents.userId, userId));
  return rows.map((r) => r.classroom);
}

export async function isParentOf(userId: string, childId: string): Promise<boolean> {
  const rows = await db
    .select({ one: sql<number>`1` })
    .from(childParents)
    .where(sql`${childParents.userId} = ${userId} and ${childParents.childId} = ${childId}`)
    .limit(1);
  return rows.length > 0;
}

export async function getChild(childId: string) {
  const rows = await db.select().from(children).where(eq(children.id, childId)).limit(1);
  return rows[0] ?? null;
}

/** Admin view: every pupil with their parents' names, grouped by classroom. */
export async function listAllChildren() {
  return db
    .select({
      id: children.id,
      name: children.name,
      surname: children.surname,
      classroom: children.classroom,
      parents: sql<string[]>`(
        select coalesce(array_agg(trim(coalesce(u.display_name,'') || ' ' || coalesce(u.surname,''))), '{}')
        from child_parents cp2 join users u on u.id = cp2.user_id
        where cp2.child_id = ${children.id}
      )`,
    })
    .from(children)
    .orderBy(asc(children.classroom), asc(children.surname), asc(children.name));
}

export async function parentsOfChildren(childIds: string[]) {
  if (childIds.length === 0) return [];
  return db
    .select({ childId: childParents.childId, userId: users.id, email: users.email })
    .from(childParents)
    .innerJoin(users, eq(users.id, childParents.userId))
    .where(inArray(childParents.childId, childIds));
}
