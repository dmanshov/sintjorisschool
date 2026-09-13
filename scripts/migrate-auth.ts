/**
 * Step 1 of the migration: Firebase Auth accounts → Neon.
 *
 * This is the script that decides whether parents notice the migration at all.
 * It carries each account's *existing* Firebase password hash across, so the
 * password they already use keeps working; the site upgrades the hash silently on
 * their next login (see src/lib/auth/password.ts).
 *
 * Produce the input first:
 *
 *   firebase login
 *   firebase use sintjorisschool-3390
 *   firebase auth:export migration-data/firebase-users.json --format=json
 *
 * That file contains password hashes. Treat it like a password file: it is
 * already in .gitignore, keep it off shared drives, and delete it when done.
 *
 * Then, in Firebase Console → Authentication → Users → ⋮ → "Password hash
 * parameters", copy the four values into FIREBASE_HASH_* in .env and verify them
 * with `npm run auth:probe` BEFORE you cut over.
 *
 *   npm run migrate:auth -- --dry-run
 *   npm run migrate:auth
 *
 * Safe to re-run: accounts are upserted by UID. An account that has already
 * logged in on the new site keeps its upgraded password hash — a re-run never
 * pushes a user back onto the legacy hash.
 */
import { readFile } from 'node:fs/promises';
import { banner, connect, Counter, isDryRun, Problems } from './lib/pg';

type FirebaseUser = {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  passwordHash?: string;
  salt?: string;
  displayName?: string;
  photoUrl?: string;
  phoneNumber?: string;
  disabled?: boolean;
  createdAt?: string;
  lastSignedInAt?: string;
  providerUserInfo?: Array<{ providerId: string; email?: string; rawId?: string }>;
};

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  // Firebase exports epoch milliseconds as a string.
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) ? new Date(asNumber) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function main() {
  banner('Firebase Auth → Neon');

  const path = process.env.FIREBASE_AUTH_EXPORT_PATH ?? './migration-data/firebase-users.json';
  const raw = await readFile(path, 'utf8').catch(() => {
    throw new Error(
      `Could not read ${path}. Run:\n  firebase auth:export ${path} --format=json\n` +
        'or set FIREBASE_AUTH_EXPORT_PATH.',
    );
  });

  const parsed = JSON.parse(raw) as { users?: FirebaseUser[] } | FirebaseUser[];
  const users = Array.isArray(parsed) ? parsed : (parsed.users ?? []);
  console.log(`\nRead ${users.length} account(s) from ${path}.`);

  const counter = new Counter();
  const problems = new Problems();
  const client = await connect();

  // Catch the thing that would otherwise silently lose an account: two Firebase
  // accounts whose emails differ only in case. Postgres enforces a
  // case-insensitive unique index, so one of them cannot be imported.
  const byLowerEmail = new Map<string, string[]>();
  for (const user of users) {
    if (!user.email) continue;
    const key = user.email.toLowerCase();
    byLowerEmail.set(key, [...(byLowerEmail.get(key) ?? []), user.localId]);
  }
  for (const [email, ids] of byLowerEmail) {
    if (ids.length > 1) {
      problems.add(
        `Duplicate email (case-insensitive) "${email}" on UIDs ${ids.join(', ')}. ` +
          'Only the first will be imported — decide with the school which account is real.',
      );
    }
  }

  const seenEmails = new Set<string>();

  try {
    if (!isDryRun) await client.query('BEGIN');

    for (const user of users) {
      if (!user.email) {
        // Anonymous or phone-only accounts. The site logs in by email, so such an
        // account could never sign in; it is reported rather than imported.
        counter.add('skipped: no email address');
        problems.add(`UID ${user.localId} has no email address; not imported.`);
        continue;
      }

      const email = user.email.trim();
      const lower = email.toLowerCase();
      if (seenEmails.has(lower)) {
        counter.add('skipped: duplicate email');
        continue;
      }
      seenEmails.add(lower);

      const hasPassword = Boolean(user.passwordHash && user.salt);
      if (!hasPassword) {
        // Google/Apple sign-in only. They can still get in via "wachtwoord
        // vergeten", which sets a real password.
        const providers = (user.providerUserInfo ?? [])
          .map((p) => p.providerId)
          .filter((p) => p !== 'password');
        counter.add('no password (federated sign-in only)');
        problems.add(
          `${email} has no password hash${providers.length > 0 ? ` (signs in with ${providers.join(', ')})` : ''}. ` +
            'They must use "wachtwoord vergeten" once.',
        );
      } else {
        counter.add('password carried over');
      }

      if (isDryRun) {
        counter.add('would import');
        continue;
      }

      /**
       * On conflict we update identity fields but leave password material alone
       * *if* the row already has a hash of our own — that means the user has
       * logged in since the cutover and re-running this script must not undo it.
       */
      const result = await client.query(
        `INSERT INTO users (
           id, email, display_name, photo_url, phone_number,
           legacy_firebase_hash, legacy_firebase_salt,
           email_verified, disabled, created_time, last_login_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, now()),$11, now())
         ON CONFLICT (id) DO UPDATE SET
           email           = EXCLUDED.email,
           display_name    = COALESCE(users.display_name, EXCLUDED.display_name),
           photo_url       = COALESCE(users.photo_url, EXCLUDED.photo_url),
           phone_number    = COALESCE(users.phone_number, EXCLUDED.phone_number),
           email_verified  = EXCLUDED.email_verified,
           disabled        = EXCLUDED.disabled,
           created_time    = LEAST(users.created_time, EXCLUDED.created_time),
           legacy_firebase_hash = CASE
             WHEN users.password_hash IS NOT NULL THEN users.legacy_firebase_hash
             ELSE EXCLUDED.legacy_firebase_hash END,
           legacy_firebase_salt = CASE
             WHEN users.password_hash IS NOT NULL THEN users.legacy_firebase_salt
             ELSE EXCLUDED.legacy_firebase_salt END,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          user.localId,
          email,
          user.displayName ?? null,
          user.photoUrl ?? null,
          user.phoneNumber ?? null,
          user.passwordHash ?? null,
          user.salt ?? null,
          user.emailVerified ?? false,
          user.disabled ?? false,
          toDate(user.createdAt),
          toDate(user.lastSignedInAt),
        ],
      );

      counter.add(result.rows[0]?.inserted ? 'inserted' : 'updated');
    }

    if (!isDryRun) await client.query('COMMIT');
  } catch (error) {
    if (!isDryRun) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  counter.report();
  problems.report();

  console.log(
    '\nNext: npm run auth:probe   (prove one real password verifies before you cut over)' +
      '\nThen: npm run migrate:firestore',
  );
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
