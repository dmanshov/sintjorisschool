/**
 * Step 4: reconciliation. Compares what is in Firestore and Firebase Auth with
 * what landed in Neon, and reports anything that cannot be explained.
 *
 * Run it after migrate:auth and migrate:firestore, and again right after the
 * cutover. It writes nothing.
 *
 *   npm run migrate:verify
 *
 * Works without Firebase credentials too, in which case it reports only the
 * internal consistency checks.
 */
import { readFile } from 'node:fs/promises';
import { connect } from './lib/pg';

type Row = Record<string, unknown>;

function pass(message: string): void {
  console.log(`  ✓ ${message}`);
}
function warn(message: string): void {
  console.log(`  ! ${message}`);
}
function fail(message: string): void {
  console.log(`  ✗ ${message}`);
}

async function main() {
  const client = await connect();
  let failures = 0;
  let warnings = 0;

  try {
    console.log('\n── Row counts in Neon ───────────────────────────────────────────────');
    const tables = ['users', 'children', 'child_parents', 'posts', 'post_likes', 'orders', 'content'];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const { rows } = await client.query<{ count: string }>(`SELECT count(*) AS count FROM ${table}`);
      counts[table] = Number(rows[0]?.count ?? 0);
      console.log(`  ${table.padEnd(14)} ${counts[table]}`);
    }

    // ── Against Firestore, when credentials are available ───────────────────
    console.log('\n── Compared with Firestore ──────────────────────────────────────────');
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? './migration-data/serviceAccount.json';
    const serviceAccountRaw = await readFile(keyPath, 'utf8').catch(() => null);

    if (!serviceAccountRaw) {
      warn(`No service account at ${keyPath}; skipping the Firestore comparison.`);
      warnings++;
    } else {
      const { default: admin } = await import('firebase-admin');
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountRaw)) });
      }
      const firestore = admin.firestore();

      const expectations: Array<[string, string]> = [
        ['Users', 'users'],
        ['Children', 'children'],
        ['Posts', 'posts'],
        ['Orders', 'orders'],
      ];

      for (const [collection, table] of expectations) {
        const snapshot = await firestore.collection(collection).count().get();
        const firestoreCount = snapshot.data().count;
        const pgCount = counts[table] ?? 0;

        if (pgCount === firestoreCount) {
          pass(`${collection}: ${firestoreCount} → ${table}: ${pgCount}`);
        } else if (table === 'users' && pgCount > firestoreCount) {
          // Normal: Firebase Auth can hold accounts that never got a Firestore doc.
          pass(
            `${collection}: ${firestoreCount} → ${table}: ${pgCount} ` +
              `(${pgCount - firestoreCount} more, expected — Auth accounts without a Firestore document)`,
          );
        } else {
          fail(
            `${collection}: ${firestoreCount} in Firestore but ${pgCount} in ${table} ` +
              `(${firestoreCount - pgCount} missing). Check the migration log for skipped documents.`,
          );
          failures++;
        }
      }
    }

    // ── Internal consistency ───────────────────────────────────────────────
    console.log('\n── Internal consistency ─────────────────────────────────────────────');

    const checks: Array<{
      label: string;
      sql: string;
      severity: 'fail' | 'warn';
      explain: (rows: Row[]) => string;
    }> = [
      {
        label: 'Accounts that can log in',
        sql: `SELECT count(*) FILTER (WHERE password_hash IS NOT NULL) AS migrated,
                     count(*) FILTER (WHERE legacy_firebase_hash IS NOT NULL) AS legacy,
                     count(*) FILTER (WHERE password_hash IS NULL AND legacy_firebase_hash IS NULL) AS none
              FROM users`,
        severity: 'warn',
        explain: (rows) => {
          const row = rows[0]!;
          return `${row.legacy} on their original Firebase password, ${row.migrated} already upgraded, ${row.none} with no password (must use "wachtwoord vergeten")`;
        },
      },
      {
        label: 'Administrators',
        sql: 'SELECT count(*)::int AS count FROM users WHERE admin',
        severity: 'fail',
        explain: (rows) => `${rows[0]!.count} administrator(s)`,
      },
      {
        label: 'Children with no parent',
        sql: `SELECT count(*)::int AS count FROM children c
              WHERE NOT EXISTS (SELECT 1 FROM child_parents cp WHERE cp.child_id = c.id)`,
        severity: 'warn',
        explain: (rows) => `${rows[0]!.count} pupil(s) nobody can see or order for`,
      },
      {
        label: 'Orders not linked to a child',
        sql: 'SELECT count(*)::int AS count FROM orders WHERE created_for_id IS NULL',
        severity: 'warn',
        explain: (rows) => `${rows[0]!.count} order(s) whose child record no longer exists`,
      },
      {
        label: 'Orders not linked to a parent',
        sql: 'SELECT count(*)::int AS count FROM orders WHERE created_by_id IS NULL',
        severity: 'warn',
        explain: (rows) => `${rows[0]!.count} order(s) whose ordering account no longer exists`,
      },
      {
        label: 'Gym orders visible at last',
        sql: `SELECT count(*)::int AS count FROM orders WHERE order_type = 'Gym T-shirt'`,
        severity: 'warn',
        explain: (rows) =>
          `${rows[0]!.count} gym T-shirt order(s) — these were invisible in the old app because of the 'Gym t-shirt' / 'Gym T-shirt' mismatch`,
      },
      {
        label: 'Articles with no classroom',
        sql: `SELECT count(*)::int AS count FROM posts WHERE cardinality(classroom) = 0`,
        severity: 'warn',
        explain: (rows) => `${rows[0]!.count} article(s) that appear in no class filter`,
      },
      {
        label: 'Posts still pointing at Firebase Storage',
        sql: `SELECT count(*)::int AS count FROM posts
              WHERE post_photo LIKE '%firebasestorage.googleapis.com%'
                 OR post_photo LIKE '%storage.googleapis.com%'`,
        severity: 'warn',
        explain: (rows) =>
          `${rows[0]!.count} photo(s) still served by Firebase Storage — do not delete that bucket until migrate:storage has run`,
      },
      {
        label: 'Open meal orders for a closed date',
        sql: `SELECT count(*)::int AS count FROM orders o
              WHERE o.order_type = 'Maaltijd' AND o.status = 'Besteld'
                AND NOT (o.consumption_dates <@ (SELECT maaltijd_datums FROM content WHERE id = 'singleton'))`,
        severity: 'warn',
        explain: (rows) =>
          `${rows[0]!.count} open meal order(s) reference a date that is not currently open for ordering (normal if a month was closed)`,
      },
      {
        label: 'Duplicate children (same name and class)',
        sql: `SELECT count(*)::int AS count FROM (
                SELECT lower(name), lower(surname), classroom
                FROM children GROUP BY 1,2,3 HAVING count(*) > 1
              ) s`,
        severity: 'warn',
        explain: (rows) =>
          `${rows[0]!.count} name/class combination(s) appear more than once — usually two parents who each added the same child in the old app`,
      },
    ];

    for (const check of checks) {
      const { rows } = await client.query<Row>(check.sql);
      const message = `${check.label}: ${check.explain(rows)}`;
      const value = Number(rows[0]?.count ?? 0);

      if (check.label === 'Administrators') {
        if (value === 0) {
          fail(`${message} — nobody can manage the site. Run: npm run admin:grant -- <email>`);
          failures++;
        } else {
          pass(message);
        }
        continue;
      }

      if (check.severity === 'warn' && value > 0) {
        warn(message);
        warnings++;
      } else {
        pass(message);
      }
    }

    console.log('\n── Result ───────────────────────────────────────────────────────────');
    if (failures > 0) {
      console.log(`  ${failures} failure(s) and ${warnings} warning(s). Do not cut over yet.\n`);
      process.exitCode = 1;
    } else {
      console.log(
        `  No failures, ${warnings} warning(s). Warnings are usually pre-existing data quirks —\n` +
          '  read them, decide they are expected, then proceed.\n',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
