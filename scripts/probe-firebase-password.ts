/**
 * Proves, before you cut over, that the FIREBASE_HASH_* values in your .env can
 * actually verify a real exported password hash.
 *
 * This is the single most important check in the whole migration. If it fails,
 * every existing parent gets "wachtwoord niet correct" on the new site and you
 * will be emailing hundreds of password resets.
 *
 * Usage — with a throwaway account whose password you know:
 *
 *   npm run auth:probe -- parent@example.be 'their-password'
 *
 * Or against the database instead of the export file:
 *
 *   npm run auth:probe -- --from-db parent@example.be 'their-password'
 *
 * Nothing is written, and the password is never logged.
 */
import { readFile } from 'node:fs/promises';
import { verifyFirebaseHash } from '../src/lib/auth/password';
import { connect } from './lib/pg';
import './load-env';

type FirebaseUser = { email?: string; passwordHash?: string; salt?: string };

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--from-db');
  const fromDb = process.argv.includes('--from-db');
  const [emailArg, password] = args;

  if (!emailArg || !password) {
    console.error(
      'Usage: npm run auth:probe -- [--from-db] <email> <password>\n' +
        '\nUse an account you control. The password is read from argv and never stored.',
    );
    process.exit(1);
  }
  const email = emailArg.toLowerCase();

  const signerKey = process.env.FIREBASE_HASH_SIGNER_KEY;
  const saltSeparator = process.env.FIREBASE_HASH_SALT_SEPARATOR;
  const rounds = Number(process.env.FIREBASE_HASH_ROUNDS ?? 8);
  const memCost = Number(process.env.FIREBASE_HASH_MEM_COST ?? 14);

  console.log('\nParameters in use:');
  console.log(`  signer key     ${signerKey ? `${signerKey.slice(0, 12)}… (${signerKey.length} chars)` : 'MISSING'}`);
  console.log(`  salt separator ${saltSeparator ?? 'MISSING'}`);
  console.log(`  rounds         ${rounds}`);
  console.log(`  mem cost       ${memCost}`);

  if (!signerKey || !saltSeparator) {
    console.error(
      '\nFIREBASE_HASH_SIGNER_KEY and FIREBASE_HASH_SALT_SEPARATOR must be set.\n' +
        'Firebase Console → Authentication → Users → ⋮ (top right) → "Password hash parameters".',
    );
    process.exit(1);
  }

  let hash: string | undefined;
  let salt: string | undefined;

  if (fromDb) {
    const client = await connect();
    try {
      const { rows } = await client.query<{ legacy_firebase_hash: string | null; legacy_firebase_salt: string | null }>(
        'SELECT legacy_firebase_hash, legacy_firebase_salt FROM users WHERE lower(email) = $1',
        [email],
      );
      if (rows.length === 0) {
        console.error(`\nNo user with email ${email} in the database. Run migrate:auth first.`);
        process.exit(1);
      }
      hash = rows[0]!.legacy_firebase_hash ?? undefined;
      salt = rows[0]!.legacy_firebase_salt ?? undefined;
      if (!hash) {
        console.error(
          `\n${email} has no legacy hash stored. Either they already logged in on the new site ` +
            '(so their password is migrated — nothing to probe), or they sign in with Google/Apple.',
        );
        process.exit(1);
      }
    } finally {
      await client.end();
    }
  } else {
    const path = process.env.FIREBASE_AUTH_EXPORT_PATH ?? './migration-data/firebase-users.json';
    const raw = await readFile(path, 'utf8').catch(() => {
      throw new Error(`Could not read ${path}. Run firebase auth:export first, or pass --from-db.`);
    });
    const parsed = JSON.parse(raw) as { users?: FirebaseUser[] } | FirebaseUser[];
    const users = Array.isArray(parsed) ? parsed : (parsed.users ?? []);
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      console.error(`\nNo account with email ${email} in ${path}.`);
      process.exit(1);
    }
    hash = user.passwordHash;
    salt = user.salt;
    if (!hash || !salt) {
      console.error(`\n${email} has no password hash in the export (federated sign-in only).`);
      process.exit(1);
    }
  }

  const ok = await verifyFirebaseHash(password, hash!, salt!, {
    signerKey,
    saltSeparator,
    rounds,
    memCost,
  });

  if (ok) {
    console.log(
      '\n  ✓ The password verifies.\n' +
        '\n  Existing accounts will log in on the new site with the password they already have,\n' +
        '  and each one is silently upgraded to the new hash format on first login.\n',
    );
    return;
  }

  console.error(
    '\n  ✗ The password did NOT verify.\n' +
      '\n  Before cutting over, check in this order:\n' +
      '    1. Is the password you typed definitely the current one for this account?\n' +
      '    2. Are signer key and salt separator copied in full, including any "=" padding?\n' +
      '    3. Do rounds and mem cost match the console exactly (commonly 8 and 14)?\n' +
      '    4. Was the export taken from the same Firebase project as the parameters?\n' +
      '\n  Do not go live until this prints ✓: every existing parent would be locked out.\n',
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
