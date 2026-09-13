import { randomBytes } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

/**
 * Media storage. S3-compatible, so it works against Cloudflare R2, AWS S3,
 * Backblaze B2 or a local MinIO without code changes.
 *
 * Existing `post_photo` values are Firebase Storage download URLs. They keep
 * working untouched — nothing here rewrites them. `scripts/migrate-storage.ts`
 * re-hosts them when you are ready to switch off the Firebase bucket; until
 * then old and new URLs coexist.
 */
let client: S3Client | null = null;

function getClient(): S3Client {
  const config = env.storage;
  if (!config) {
    throw new StorageNotConfiguredError(
      'Uploads zijn nog niet geconfigureerd. Stel S3_ENDPOINT, S3_BUCKET, ' +
        'S3_ACCESS_KEY_ID en S3_SECRET_ACCESS_KEY in.',
    );
  }
  client ??= new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return client;
}

export class StorageNotConfiguredError extends Error {}

export function isStorageConfigured(): boolean {
  return env.storage !== undefined;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf']);
const MAX_BYTES = 15 * 1024 * 1024;

export type UploadKind = 'image' | 'document';

function extensionFor(type: string, fallbackName: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
  };
  return map[type] ?? (fallbackName.split('.').pop() ?? 'bin').toLowerCase().slice(0, 8);
}

/**
 * Validates and stores one uploaded file, returning the public URL.
 *
 * The content type is checked against an allowlist rather than trusting the
 * filename, and the stored object key is generated — never derived from the
 * user's filename — so an upload cannot overwrite an existing object or escape
 * its prefix.
 */
export async function uploadFile(
  file: File,
  kind: UploadKind,
  prefix: string,
): Promise<string> {
  const config = env.storage;
  if (!config) throw new StorageNotConfiguredError('Uploads zijn niet geconfigureerd.');

  const allowed = kind === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
  if (!allowed.has(file.type)) {
    throw new Error(
      kind === 'image'
        ? 'Enkel JPG-, PNG-, WEBP- of GIF-afbeeldingen zijn toegelaten.'
        : 'Enkel PDF-bestanden zijn toegelaten.',
    );
  }
  if (file.size === 0) throw new Error('Het bestand is leeg.');
  if (file.size > MAX_BYTES) {
    throw new Error(`Het bestand is te groot (max ${Math.floor(MAX_BYTES / 1024 / 1024)} MB).`);
  }

  const key = `${prefix.replace(/^\/+|\/+$/g, '')}/${Date.now()}-${randomBytes(8).toString('hex')}.${extensionFor(file.type, file.name)}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getClient().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const base = config.publicBaseUrl.replace(/\/+$/, '');
  return base ? `${base}/${key}` : `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${key}`;
}
