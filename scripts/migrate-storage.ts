/**
 * Step 3 (optional, and do it last): Firebase Storage files → S3-compatible
 * storage, rewriting the URLs stored in the database.
 *
 * Nothing breaks if you never run this. Existing `post_photo` values are public
 * Firebase download URLs and keep working on their own; Firebase Storage is
 * cheap and can stay indefinitely. Run this when you want to switch the Firebase
 * project off completely.
 *
 * Needs the same service account as migrate:firestore, plus the S3_* variables.
 *
 *   npm run migrate:storage -- --dry-run
 *   npm run migrate:storage
 *
 * Safe to re-run: a URL that already points at the new bucket is left alone.
 *
 * Do NOT delete the Firebase bucket until `npm run migrate:verify` reports zero
 * "Posts still pointing at Firebase Storage", and give it a few days after that
 * in case a browser or a Facebook post still holds a cached old link.
 */
import { readFile } from 'node:fs/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { banner, connect, Counter, isDryRun, Problems } from './lib/pg';

type Target = { table: 'posts' | 'content'; column: string; id: string; url: string };

/**
 * Firebase download URLs look like
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>?alt=media&token=…
 * The object path is the percent-encoded segment after /o/.
 */
function objectPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const match = parsed.pathname.match(/\/o\/(.+)$/);
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    if (parsed.hostname === 'storage.googleapis.com') {
      // https://storage.googleapis.com/<bucket>/<path>
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments.length > 1 ? decodeURIComponent(segments.slice(1).join('/')) : null;
    }
    return null;
  } catch {
    return null;
  }
}

function contentTypeFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
  };
  return map[extension] ?? 'application/octet-stream';
}

async function main() {
  banner('Firebase Storage → S3-compatible storage');

  const bucketName = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? '').replace(/\/+$/, '');

  if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey || !publicBase) {
    throw new Error(
      'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and ' +
        'NEXT_PUBLIC_MEDIA_BASE_URL must all be set before re-hosting media.',
    );
  }

  const { default: admin } = await import('firebase-admin');
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? './migration-data/serviceAccount.json';
  const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'));
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? `${serviceAccount.project_id}.appspot.com`,
    });
  }
  const firebaseBucket = admin.storage().bucket();

  const s3 = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const counter = new Counter();
  const problems = new Problems();
  const client = await connect();

  try {
    const targets: Target[] = [];

    const posts = await client.query<{ id: string; post_photo: string }>(
      `SELECT id, post_photo FROM posts
       WHERE post_photo LIKE '%firebasestorage.googleapis.com%'
          OR post_photo LIKE '%storage.googleapis.com%'`,
    );
    for (const row of posts.rows) {
      targets.push({ table: 'posts', column: 'post_photo', id: row.id, url: row.post_photo });
    }

    const contentRow = await client.query<Record<string, string | null>>(
      `SELECT * FROM content WHERE id = 'singleton'`,
    );
    const content = contentRow.rows[0];
    if (content) {
      const columns = Object.keys(content).filter(
        (column) => column === 'team_foto' || column.startsWith('benodigdheden_'),
      );
      for (const column of columns) {
        const value = content[column];
        if (value && objectPathFromUrl(value)) {
          targets.push({ table: 'content', column, id: 'singleton', url: value });
        }
      }
    }

    console.log(`\n${targets.length} file reference(s) to re-host.`);

    // The menu PDFs live in an array column, handled separately below.
    const menus = (content?.maaltijd as unknown as string[] | null) ?? [];
    const menusToMove = menus.filter((url) => objectPathFromUrl(url));
    if (menusToMove.length > 0) {
      console.log(`${menusToMove.length} menu PDF(s) in content.maaltijd.`);
    }

    /** Copies one object across and returns its new public URL. */
    const rehost = async (url: string): Promise<string | null> => {
      const path = objectPathFromUrl(url);
      if (!path) {
        problems.add(`Could not work out the object path from ${url.slice(0, 120)}`);
        return null;
      }

      const file = firebaseBucket.file(path);
      const [exists] = await file.exists();
      if (!exists) {
        problems.add(`${path} is referenced in the database but missing from Firebase Storage.`);
        counter.add('missing in Firebase Storage');
        return null;
      }

      if (isDryRun) {
        counter.add('would copy');
        return `${publicBase}/${path}`;
      }

      const [body] = await file.download();
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: path,
          Body: body,
          ContentType: contentTypeFor(path),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      counter.add('copied');
      counter.add('bytes copied', body.byteLength);
      return `${publicBase}/${path}`;
    };

    for (const target of targets) {
      const newUrl = await rehost(target.url);
      if (!newUrl || isDryRun) continue;

      // The column name comes from our own allowlist above, never from user input.
      await client.query(
        `UPDATE ${target.table} SET ${target.column} = $2 WHERE id = $1`,
        [target.id, newUrl],
      );
      counter.add('database references rewritten');
    }

    if (menusToMove.length > 0) {
      const rewritten: string[] = [];
      for (const url of menus) {
        const newUrl = objectPathFromUrl(url) ? await rehost(url) : null;
        rewritten.push(newUrl ?? url);
      }
      if (!isDryRun) {
        await client.query(`UPDATE content SET maaltijd = $1 WHERE id = 'singleton'`, [rewritten]);
        counter.add('database references rewritten', menusToMove.length);
      }
    }
  } finally {
    await client.end();
  }

  counter.report();
  problems.report();

  console.log(
    '\nRun `npm run migrate:verify` and confirm "Posts still pointing at Firebase Storage" is 0.' +
      '\nLeave the Firebase bucket in place for a few more days: cached pages and shared links may still use the old URLs.',
  );
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
