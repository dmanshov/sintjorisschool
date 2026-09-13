/**
 * Step 2 of the migration: Firestore documents → Neon.
 *
 * Run `migrate:auth` first. This script enriches the user rows it created and
 * then loads Children, Posts, Orders and Content. Firestore document IDs become
 * Postgres primary keys, so every DocumentReference in the old data resolves
 * without a lookup table and nothing is renumbered.
 *
 * Needs a Firebase service account with Firestore read access:
 *   Firebase Console → Project settings → Service accounts → Generate new private key
 *   Save it as migration-data/serviceAccount.json (gitignored).
 *
 *   npm run migrate:firestore -- --dry-run
 *   npm run migrate:firestore
 *
 * Safe to re-run: every write is an upsert keyed on the Firestore document ID.
 * Re-running after a few days of live use will overwrite newer edits made on the
 * new site, so only re-run while the old site is still the source of truth.
 */
import { readFile } from 'node:fs/promises';
import type { Client } from 'pg';
import { banner, connect, Counter, isDryRun, Problems } from './lib/pg';

const CLASSROOMS = new Set([
  'KK0', 'KK1', 'KK2', 'KK3', 'L1', 'L2A', 'L2B', 'L3', 'L4', 'L5A', 'L5B', 'L6',
]);
const POST_CLASSROOMS = new Set([...CLASSROOMS, 'LEESKLAS']);
const ORDER_TYPES = new Set(['Drankkaart', 'Badmuts', 'Gym T-shirt', 'Maaltijd']);
const ORDER_STATUSES = new Set(['Besteld', 'Uitgedeeld', 'Gefactureerd']);

/**
 * The old app wrote gym orders as 'Gym t-shirt' but every query filtered on
 * 'Gym T-shirt', so those orders were invisible in both the parent and admin
 * screens. Normalising here is what makes them appear.
 */
function normaliseOrderType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const canonical = [...ORDER_TYPES].find((t) => t.toLowerCase() === trimmed.toLowerCase());
  return canonical ?? null;
}

function normaliseStatus(value: unknown): string {
  if (typeof value !== 'string') return 'Besteld';
  const trimmed = value.trim();
  const canonical = [...ORDER_STATUSES].find((s) => s.toLowerCase() === trimmed.toLowerCase());
  return canonical ?? 'Besteld';
}

/** Firestore Timestamp | Date | string | number → Date | null. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const date = (value as { toDate(): Date }).toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Firestore DocumentReference (or a stored path string) → document id. */
function refId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parts = value.split('/').filter(Boolean);
    return parts.at(-1) ?? null;
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter((item): item is string => item !== null);
}

function refIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => refId(item)).filter((item): item is string => item !== null);
}

async function main() {
  banner('Firestore → Neon');

  const { default: admin } = await import('firebase-admin');
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? './migration-data/serviceAccount.json';
  const serviceAccount = JSON.parse(
    await readFile(keyPath, 'utf8').catch(() => {
      throw new Error(
        `Could not read ${keyPath}. Download a service account key from\n` +
          'Firebase Console → Project settings → Service accounts → Generate new private key.',
      );
    }),
  );

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const firestore = admin.firestore();

  const counter = new Counter();
  const problems = new Problems();
  const client = await connect();

  try {
    if (!isDryRun) await client.query('BEGIN');

    // The set of user IDs that actually exist, so a dangling reference becomes a
    // reported NULL rather than a foreign-key crash halfway through.
    const knownUsers = new Set(
      (await client.query<{ id: string }>('SELECT id FROM users')).rows.map((r) => r.id),
    );
    console.log(`\n${knownUsers.size} user row(s) already present (from migrate:auth).`);

    await migrateUsers(firestore, client, counter, problems, knownUsers);
    const knownChildren = await migrateChildren(firestore, client, counter, problems, knownUsers);
    await migratePosts(firestore, client, counter, problems, knownUsers);
    await migrateOrders(firestore, client, counter, problems, knownUsers, knownChildren);
    await migrateContent(firestore, client, counter, problems);

    if (!isDryRun) await client.query('COMMIT');
  } catch (error) {
    if (!isDryRun) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  counter.report();
  problems.report();
  console.log('\nNext: npm run migrate:verify');
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateUsers(
  firestore: import('firebase-admin').firestore.Firestore,
  client: Client,
  counter: Counter,
  problems: Problems,
  knownUsers: Set<string>,
) {
  console.log('\nUsers…');
  const snapshot = await firestore.collection('Users').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const email = text(data.email);

    if (!knownUsers.has(id)) {
      /**
       * A Firestore user document with no matching Auth account. This happens when
       * an account was deleted from Auth but its document stayed behind (the old
       * project's onUserDeleted Cloud Function was an empty stub — it looked up the
       * document and then did nothing with it). Such a profile cannot log in, so
       * it is created only when it has an email, to keep its children and orders
       * attached to something.
       */
      if (!email) {
        counter.add('Users: skipped (no Auth account, no email)');
        problems.add(`Users/${id} has no Auth account and no email; skipped.`);
        continue;
      }
      if (!isDryRun) {
        await client.query(
          `INSERT INTO users (id, email, created_time)
           VALUES ($1, $2, COALESCE($3, now()))
           ON CONFLICT (id) DO NOTHING`,
          [id, email, toDate(data.created_time)],
        );
      }
      knownUsers.add(id);
      counter.add('Users: created without Auth account (cannot log in)');
      problems.add(
        `Users/${id} (${email}) exists in Firestore but not in Firebase Auth. ` +
          'Imported so their data stays linked, but they must use "wachtwoord vergeten" to get a password.',
      );
    }

    const teacherClassroom = stringArray(data.teacher_classroom).filter((room) => {
      if (CLASSROOMS.has(room)) return true;
      problems.add(`Users/${id}: unknown teacher classroom "${room}" dropped.`);
      return false;
    });

    if (isDryRun) {
      counter.add('Users: would update');
      continue;
    }

    await client.query(
      `UPDATE users SET
         email             = COALESCE($2, email),
         display_name      = COALESCE($3, display_name),
         surname           = COALESCE($4, surname),
         phone_number      = COALESCE($5, phone_number),
         photo_url         = COALESCE($6, photo_url),
         admin             = $7,
         teacher           = $8,
         teacher_classroom = $9,
         created_time      = LEAST(created_time, COALESCE($10, created_time)),
         updated_at        = now()
       WHERE id = $1`,
      [
        id,
        email,
        text(data.display_name),
        text(data.surname),
        text(data.phone_number),
        text(data.photo_url),
        bool(data.admin),
        bool(data.teacher),
        teacherClassroom,
        toDate(data.created_time),
      ],
    );
    counter.add('Users: updated');
  }

  if (!isDryRun) {
    const admins = await client.query<{ count: string }>(
      'SELECT count(*) AS count FROM users WHERE admin',
    );
    const adminCount = Number(admins.rows[0]?.count ?? 0);
    console.log(`  ${adminCount} administrator(s).`);
    if (adminCount === 0) {
      problems.add(
        'No administrators found. Run `npm run admin:grant -- <email>` or nobody can manage the site.',
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateChildren(
  firestore: import('firebase-admin').firestore.Firestore,
  client: Client,
  counter: Counter,
  problems: Problems,
  knownUsers: Set<string>,
): Promise<Set<string>> {
  console.log('\nChildren…');
  const snapshot = await firestore.collection('Children').get();
  const known = new Set<string>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const name = text(data.name);
    let classroom = text(data.classroom);

    if (!name) {
      counter.add('Children: skipped (no name)');
      problems.add(`Children/${id} has no name; skipped.`);
      continue;
    }

    if (!classroom || !CLASSROOMS.has(classroom)) {
      /**
       * Firestore accepted any string here. A child with a classroom the new
       * schema does not know about would violate the CHECK constraint, so they are
       * parked in KK0 and reported — losing the pupil entirely would be worse than
       * a wrong class the school can correct in one click.
       */
      problems.add(
        `Children/${id} (${name}) has classroom "${classroom ?? '(empty)'}", which is not a known class. ` +
          'Imported as KK0 — correct it in the profile screen.',
      );
      counter.add('Children: classroom corrected to KK0');
      classroom = 'KK0';
    }

    const parents = refIdArray(data.parents);
    const validParents = parents.filter((parentId) => {
      if (knownUsers.has(parentId)) return true;
      problems.add(`Children/${id} (${name}) references missing parent ${parentId}; link dropped.`);
      return false;
    });

    if (validParents.length === 0) {
      // An orphaned pupil is invisible to every parent and cannot be ordered for.
      problems.add(
        `Children/${id} (${name}, ${classroom}) has no surviving parent link. ` +
          'Imported, but no one can see or order for this child until a parent adds them again.',
      );
      counter.add('Children: orphaned (no parent)');
    }

    if (isDryRun) {
      counter.add('Children: would import');
      known.add(id);
      continue;
    }

    await client.query(
      `INSERT INTO children (id, name, surname, classroom)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         surname = EXCLUDED.surname,
         classroom = EXCLUDED.classroom,
         updated_at = now()`,
      [id, name, text(data.surname) ?? '', classroom],
    );

    for (const parentId of validParents) {
      await client.query(
        `INSERT INTO child_parents (child_id, user_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [id, parentId],
      );
    }

    known.add(id);
    counter.add('Children: imported');
    counter.add('Children: parent links', validParents.length);
  }

  return known;
}

// ─────────────────────────────────────────────────────────────────────────────
async function migratePosts(
  firestore: import('firebase-admin').firestore.Firestore,
  client: Client,
  counter: Counter,
  problems: Problems,
  knownUsers: Set<string>,
) {
  console.log('\nPosts…');
  const snapshot = await firestore.collection('Posts').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;

    const classroom = stringArray(data.classroom).filter((room) => {
      if (POST_CLASSROOMS.has(room)) return true;
      problems.add(`Posts/${id}: unknown classroom "${room}" dropped.`);
      return false;
    });

    if (classroom.length === 0) {
      // Such an article was unreachable in the old app's filtered list too.
      problems.add(
        `Posts/${id} ("${text(data.post_title) ?? 'untitled'}") has no valid classroom. ` +
          'Imported, but it will not appear in any class filter until a classroom is set.',
      );
      counter.add('Posts: no classroom');
    }

    const authorId = refId(data.post_user);
    const author = authorId && knownUsers.has(authorId) ? authorId : null;
    if (authorId && !author) {
      problems.add(`Posts/${id} was written by deleted user ${authorId}; author cleared.`);
      counter.add('Posts: author missing');
    }

    const likes = refIdArray(data.likes).filter((userId) => knownUsers.has(userId));
    const droppedLikes = refIdArray(data.likes).length - likes.length;
    if (droppedLikes > 0) counter.add('Posts: likes from deleted users dropped', droppedLikes);

    if (isDryRun) {
      counter.add('Posts: would import');
      continue;
    }

    await client.query(
      `INSERT INTO posts (
         id, post_title, post_description, post_photo, album_url, external_url,
         classroom, pinned, post_user_id, time_posted
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, now()))
       ON CONFLICT (id) DO UPDATE SET
         post_title = EXCLUDED.post_title,
         post_description = EXCLUDED.post_description,
         post_photo = EXCLUDED.post_photo,
         album_url = EXCLUDED.album_url,
         external_url = EXCLUDED.external_url,
         classroom = EXCLUDED.classroom,
         pinned = EXCLUDED.pinned,
         post_user_id = EXCLUDED.post_user_id,
         time_posted = EXCLUDED.time_posted,
         updated_at = now()`,
      [
        id,
        text(data.post_title) ?? '',
        text(data.post_description) ?? '',
        text(data.post_photo),
        text(data.album_url),
        text(data.external_url),
        classroom,
        bool(data.pinned),
        author,
        toDate(data.time_posted),
      ],
    );

    for (const userId of likes) {
      await client.query(
        'INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [id, userId],
      );
    }

    counter.add('Posts: imported');
    counter.add('Posts: likes', likes.length);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateOrders(
  firestore: import('firebase-admin').firestore.Firestore,
  client: Client,
  counter: Counter,
  problems: Problems,
  knownUsers: Set<string>,
  knownChildren: Set<string>,
) {
  console.log('\nOrders…');
  const snapshot = await firestore.collection('Orders').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;

    const orderType = normaliseOrderType(data.order_type);
    if (!orderType) {
      counter.add('Orders: skipped (unknown type)');
      problems.add(`Orders/${id} has unknown order_type "${String(data.order_type)}"; skipped.`);
      continue;
    }
    if (typeof data.order_type === 'string' && data.order_type !== orderType) {
      counter.add(`Orders: type normalised ("${data.order_type}" → "${orderType}")`);
    }

    const createdBy = refId(data.created_by);
    const createdFor = refId(data.created_for);

    const byId = createdBy && knownUsers.has(createdBy) ? createdBy : null;
    const forId = createdFor && knownChildren.has(createdFor) ? createdFor : null;

    if (createdBy && !byId) counter.add('Orders: ordering parent no longer exists');
    if (createdFor && !forId) counter.add('Orders: child no longer exists');

    // quantity was a double in Firestore and must be > 0 here.
    let quantity = num(data.quantity, 1);
    if (!(quantity > 0)) {
      problems.add(`Orders/${id} had quantity ${String(data.quantity)}; stored as 1.`);
      quantity = 1;
    }

    const classroom = text(data.created_for_classroom);
    if (classroom && !CLASSROOMS.has(classroom)) {
      // Kept as-is: this is a historical record of the class at order time and has
      // no CHECK constraint, precisely so old data survives a class being renamed.
      counter.add('Orders: historical classroom no longer in use');
    }

    if (isDryRun) {
      counter.add('Orders: would import');
      continue;
    }

    await client.query(
      `INSERT INTO orders (
         id, order_type, status, quantity, created_by_id, created_for_id,
         created_by_name, created_by_surname, created_by_email,
         created_for_name, created_for_surname, created_for_classroom,
         color, size, consumption_month, consumption_dates,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 COALESCE($17, now()), COALESCE($18, now()))
       ON CONFLICT (id) DO UPDATE SET
         order_type = EXCLUDED.order_type,
         status = EXCLUDED.status,
         quantity = EXCLUDED.quantity,
         created_by_id = EXCLUDED.created_by_id,
         created_for_id = EXCLUDED.created_for_id,
         created_by_name = EXCLUDED.created_by_name,
         created_by_surname = EXCLUDED.created_by_surname,
         created_by_email = EXCLUDED.created_by_email,
         created_for_name = EXCLUDED.created_for_name,
         created_for_surname = EXCLUDED.created_for_surname,
         created_for_classroom = EXCLUDED.created_for_classroom,
         color = EXCLUDED.color,
         size = EXCLUDED.size,
         consumption_month = EXCLUDED.consumption_month,
         consumption_dates = EXCLUDED.consumption_dates,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        id,
        orderType,
        normaliseStatus(data.status),
        quantity,
        byId,
        forId,
        text(data.created_by_name),
        text(data.created_by_surname),
        text(data.created_by_email),
        text(data.created_for_name),
        text(data.created_for_surname),
        classroom,
        text(data.Color) ?? text(data.color),
        text(data.Size) ?? text(data.size),
        text(data.consumption_month),
        stringArray(data.consumption_dates),
        toDate(data.created_at),
        toDate(data.updated_at),
      ],
    );

    counter.add('Orders: imported');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateContent(
  firestore: import('firebase-admin').firestore.Firestore,
  client: Client,
  counter: Counter,
  problems: Problems,
) {
  console.log('\nContent…');
  const snapshot = await firestore.collection('Content').get();

  if (snapshot.empty) {
    problems.add('The Content collection is empty; the site will show its built-in fallback text.');
    return;
  }
  if (snapshot.size > 1) {
    problems.add(
      `The Content collection holds ${snapshot.size} documents. The site uses a single row, so the ` +
        'first document wins. Check that the others are not the live ones.',
    );
  }

  const data = snapshot.docs[0]!.data();

  /** Firestore field name → Postgres column. */
  const MAP: Array<[string, string]> = [
    ['Maaltijd_Maand', 'maaltijd_maand'],
    ['Maaltijd_Bericht', 'maaltijd_bericht'],
    ['Inschrijvingen', 'inschrijvingen'],
    ['Welkom', 'welkom'],
    ['Schoolreglement', 'schoolreglement'],
    ['TeamFoto', 'team_foto'],
    ['TeamDirecteur', 'team_directeur'],
    ['TeamAdministratie', 'team_administratie'],
    ['TeamKleuterschool', 'team_kleuterschool'],
    ['TeamLagereSchool', 'team_lagere_school'],
    ['TeamAmbulant', 'team_ambulant'],
    ['TeamZorg', 'team_zorg'],
    ['TeamGym', 'team_gym'],
    ['TeamOnderhoud', 'team_onderhoud'],
    ['BenodigdhedenKK0', 'benodigdheden_kk0'],
    ['BenodigdhedenKK1', 'benodigdheden_kk1'],
    ['BenodigdhedenKK2', 'benodigdheden_kk2'],
    ['BenodigdhedenKK3', 'benodigdheden_kk3'],
    ['BenodigdhedenL1', 'benodigdheden_l1'],
    ['BenodigdhedenL2', 'benodigdheden_l2'],
    ['BenodigdhedenL3', 'benodigdheden_l3'],
    ['BenodigdhedenL4', 'benodigdheden_l4'],
    ['BenodigdhedenL5', 'benodigdheden_l5'],
    ['BenodigdhedenL6', 'benodigdheden_l6'],
    ['BestuurVoorzitter', 'bestuur_voorzitter'],
    ['BestuurLeden', 'bestuur_leden'],
    ['OndersteuningVestiging', 'ondersteuning_vestiging'],
    ['OndersteuningVoorwaarden', 'ondersteuning_voorwaarden'],
    ['Ziekte', 'ziekte'],
    ['Opvang', 'opvang'],
    ['CLBCoordinator', 'clb_coordinator'],
    ['CLBMedewerkers', 'clb_medewerkers'],
  ];

  const columns = ['id', 'maaltijd', 'maaltijd_datums', ...MAP.map(([, column]) => column)];
  const values: unknown[] = [
    'singleton',
    stringArray(data.Maaltijd),
    stringArray(data.Maaltijd_Datums),
    ...MAP.map(([field]) => text(data[field])),
  ];

  const filled = values.slice(3).filter((value) => value !== null).length;
  console.log(`  ${filled} of ${MAP.length} text field(s) have content.`);

  if (isDryRun) {
    counter.add('Content: would import');
    return;
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updates = columns
    .slice(1)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ');

  await client.query(
    `INSERT INTO content (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updates}, updated_at = now()`,
    values,
  );

  counter.add('Content: imported');
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
