'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireStaff, requireUser } from '@/lib/auth/session';
import { isStorageConfigured, uploadFile } from '@/lib/storage';
import { POST_CLASSROOMS, postLikes, posts } from '@db/schema';

export type ActionState = { error?: string; success?: string } | null;

function validClassrooms(values: string[]): string[] {
  return values.filter((v) => (POST_CLASSROOMS as readonly string[]).includes(v));
}

/**
 * Teachers may publish for their own classes; admins for any.
 * This is the rule the old app drew in the UI and nowhere else.
 */
function assertMayPublishFor(
  user: { admin: boolean; teacherClassroom: string[] },
  classrooms: string[],
): string | null {
  if (user.admin) return null;
  const allowed = new Set(user.teacherClassroom ?? []);
  // The reading class is shared, so any teacher may post to it.
  allowed.add('LEESKLAS');
  const forbidden = classrooms.filter((c) => !allowed.has(c));
  if (forbidden.length > 0) {
    return `Je kan enkel artikels publiceren voor je eigen klas (niet voor ${forbidden.join(', ')}).`;
  }
  return null;
}

async function photoUrlFrom(formData: FormData): Promise<string | null> {
  const file = formData.get('photo');
  if (file instanceof File && file.size > 0) {
    if (!isStorageConfigured()) {
      throw new Error(
        'Afbeeldingen opladen is nog niet geconfigureerd. Gebruik voorlopig een link naar een foto.',
      );
    }
    return uploadFile(file, 'image', 'posts');
  }
  const url = String(formData.get('photoUrl') ?? '').trim();
  return url || null;
}

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();

  const postTitle = String(formData.get('postTitle') ?? '').trim();
  const postDescription = String(formData.get('postDescription') ?? '').trim();
  const albumUrl = String(formData.get('albumUrl') ?? '').trim();
  const externalUrl = String(formData.get('externalUrl') ?? '').trim();
  const classroom = validClassrooms(formData.getAll('classroom').map(String));

  if (!postTitle) return { error: 'Schrijf een korte, duidelijke titel.' };
  if (classroom.length === 0) {
    return { error: 'Je moet minstens 1 klas aanduiden waarop het artikel betrekking heeft.' };
  }
  const forbidden = assertMayPublishFor(user, classroom);
  if (forbidden) return { error: forbidden };

  let postPhoto: string | null;
  try {
    postPhoto = await photoUrlFrom(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Het opladen is mislukt.' };
  }

  await db.insert(posts).values({
    id: randomBytes(12).toString('hex'),
    postTitle,
    postDescription,
    postPhoto,
    albumUrl: albumUrl || null,
    externalUrl: externalUrl || null,
    classroom,
    pinned: false,
    postUserId: user.id,
    timePosted: new Date(),
  });

  revalidatePath('/schoolkrant');
  revalidatePath('/');
  revalidatePath('/home');
  revalidatePath('/admin');
  return { success: 'Je artikel werd met succes gepubliceerd in de schoolkrant.' };
}

export async function updatePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const postId = String(formData.get('postId') ?? '');

  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  const existing = rows[0];
  if (!existing) return { error: 'Dit artikel werd niet gevonden.' };

  // A teacher may edit their own articles; an admin may edit any.
  if (!user.admin && existing.postUserId !== user.id) {
    return { error: 'Je kan enkel je eigen artikels aanpassen.' };
  }

  const postTitle = String(formData.get('postTitle') ?? '').trim();
  const postDescription = String(formData.get('postDescription') ?? '').trim();
  const albumUrl = String(formData.get('albumUrl') ?? '').trim();
  const externalUrl = String(formData.get('externalUrl') ?? '').trim();
  const classroom = validClassrooms(formData.getAll('classroom').map(String));

  if (!postTitle) return { error: 'Schrijf een korte, duidelijke titel.' };
  if (classroom.length === 0) {
    return { error: 'Je moet minstens 1 klas aanduiden waarop het artikel betrekking heeft.' };
  }
  const forbidden = assertMayPublishFor(user, classroom);
  if (forbidden) return { error: forbidden };

  let postPhoto = existing.postPhoto;
  try {
    postPhoto = (await photoUrlFrom(formData)) ?? existing.postPhoto;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Het opladen is mislukt.' };
  }

  await db
    .update(posts)
    .set({
      postTitle,
      postDescription,
      postPhoto,
      albumUrl: albumUrl || null,
      externalUrl: externalUrl || null,
      classroom,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  revalidatePath('/schoolkrant');
  revalidatePath('/');
  revalidatePath('/home');
  revalidatePath('/admin');
  return { success: 'Het artikel werd aangepast.' };
}

export async function setPostPinnedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const postId = String(formData.get('postId') ?? '');
  const pinned = formData.get('pinned') === 'true';

  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  const existing = rows[0];
  if (!existing) return { error: 'Dit artikel werd niet gevonden.' };
  if (!user.admin && existing.postUserId !== user.id) {
    return { error: 'Je kan enkel je eigen artikels vastpinnen.' };
  }

  await db.update(posts).set({ pinned, updatedAt: new Date() }).where(eq(posts.id, postId));

  revalidatePath('/schoolkrant');
  revalidatePath('/');
  revalidatePath('/home');
  return {
    success: pinned
      ? 'Het artikel staat nu op de homepage.'
      : 'Het artikel staat niet langer op de homepage.',
  };
}

export async function deletePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const postId = String(formData.get('postId') ?? '');

  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  const existing = rows[0];
  if (!existing) return { error: 'Dit artikel werd niet gevonden.' };
  if (!user.admin && existing.postUserId !== user.id) {
    return { error: 'Je kan enkel je eigen artikels verwijderen.' };
  }

  await db.delete(posts).where(eq(posts.id, postId));

  revalidatePath('/schoolkrant');
  revalidatePath('/');
  revalidatePath('/home');
  revalidatePath('/admin');
  return { success: 'Het artikel werd met succes verwijderd.' };
}

/**
 * Like / unlike. One row per (post, user), so a double click cannot double count.
 * Used directly as a `<form action>`, so it takes only the FormData.
 */
export async function toggleLikeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const postId = String(formData.get('postId') ?? '');

  const existing = await db
    .select({ postId: postLikes.postId })
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, user.id)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, user.id)));
  } else {
    await db.insert(postLikes).values({ postId, userId: user.id }).onConflictDoNothing();
  }

  revalidatePath('/schoolkrant');
  revalidatePath('/');
}
