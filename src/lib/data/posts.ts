import { and, arrayOverlaps, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { safeRead, type DbFailure } from '@/lib/db-status';
import { postLikes, posts, users } from '@db/schema';

export type PostWithMeta = {
  id: string;
  postTitle: string;
  postDescription: string;
  postPhoto: string | null;
  albumUrl: string | null;
  externalUrl: string | null;
  classroom: string[];
  pinned: boolean;
  timePosted: Date;
  authorName: string | null;
  likeCount: number;
  likedByViewer: boolean;
};

/**
 * One query for a page of articles, including like counts and whether the
 * current viewer liked each one. The old app read the whole `likes` array of
 * every post into the browser to answer that question, which also meant every
 * reader could see exactly which parents had liked which article.
 */
function postSelection(viewerId: string | null) {
  return {
    id: posts.id,
    postTitle: posts.postTitle,
    postDescription: posts.postDescription,
    postPhoto: posts.postPhoto,
    albumUrl: posts.albumUrl,
    externalUrl: posts.externalUrl,
    classroom: posts.classroom,
    pinned: posts.pinned,
    timePosted: posts.timePosted,
    authorName: sql<string | null>`nullif(trim(coalesce(${users.displayName}, '') || ' ' || coalesce(${users.surname}, '')), '')`,
    likeCount: sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`,
    likedByViewer: viewerId
      ? sql<boolean>`exists (select 1 from ${postLikes} where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${viewerId})`
      : sql<boolean>`false`,
  };
}

export type ListPostsOptions = {
  classrooms?: string[];
  pinnedOnly?: boolean;
  limit?: number;
  offset?: number;
  viewerId?: string | null;
};

export async function listPosts(options: ListPostsOptions = {}): Promise<PostWithMeta[]> {
  const { classrooms, pinnedOnly, limit = 20, offset = 0, viewerId = null } = options;

  const conditions = [];
  if (pinnedOnly) conditions.push(eq(posts.pinned, true));
  if (classrooms && classrooms.length > 0) {
    conditions.push(arrayOverlaps(posts.classroom, classrooms));
  }

  return db
    .select(postSelection(viewerId))
    .from(posts)
    .leftJoin(users, eq(users.id, posts.postUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.pinned), desc(posts.timePosted))
    .limit(limit)
    .offset(offset);
}

export async function countPosts(classrooms?: string[]): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(classrooms && classrooms.length > 0 ? arrayOverlaps(posts.classroom, classrooms) : undefined);
  return rows[0]?.count ?? 0;
}

export async function getPost(id: string, viewerId: string | null = null): Promise<PostWithMeta | null> {
  const rows = await db
    .select(postSelection(viewerId))
    .from(posts)
    .leftJoin(users, eq(users.id, posts.postUserId))
    .where(eq(posts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Articles, or an empty list plus a reason when the database cannot answer. The
 * page then shows its "no articles" state rather than a 500 — a school's address
 * and opening hours should stay readable even when the news feed cannot load.
 */
export async function listPostsSafe(
  options: ListPostsOptions = {},
): Promise<{ posts: PostWithMeta[]; failure: DbFailure }> {
  const { value, failure } = await safeRead('posts', () => listPosts(options), []);
  return { posts: value, failure };
}

export async function countPostsSafe(classrooms?: string[]): Promise<number> {
  const { value } = await safeRead('posts count', () => countPosts(classrooms), 0);
  return value;
}
