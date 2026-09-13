/**
 * Integration tests against a real Postgres.
 *
 * Skipped automatically when DATABASE_URL is absent, so `npm test` still runs the
 * pure-function tests anywhere. To run these:
 *
 *   createdb sintjorisschool && DATABASE_URL=postgresql://localhost/sintjorisschool \
 *     npm run db:apply && npm test
 *
 * They cover the things that would actually hurt if they broke: the legacy
 * password upgrade writing correctly, the constraints that stop bad order data,
 * and the CSV escaping the old Dart export did not have.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test, { after, before } from 'node:test';
import '../scripts/load-env';

const DATABASE_URL = process.env.DATABASE_URL;
const skip = !DATABASE_URL ? 'DATABASE_URL is not set' : false;

// Imported lazily so the module does not throw when the suite is skipped.
type Deps = {
  db: typeof import('../src/lib/db')['db'];
  schema: typeof import('@db/schema');
  password: typeof import('../src/lib/auth/password');
  orders: typeof import('../src/lib/data/orders');
  children: typeof import('../src/lib/data/children');
  users: typeof import('../src/lib/data/users');
};

let deps: Deps;
const createdUserIds: string[] = [];
const createdChildIds: string[] = [];
const createdOrderIds: string[] = [];

before(async () => {
  if (skip) return;
  process.env.SESSION_SECRET ??= 'test-secret-not-used-for-anything-real';
  deps = {
    db: (await import('../src/lib/db')).db,
    schema: await import('@db/schema'),
    password: await import('../src/lib/auth/password'),
    orders: await import('../src/lib/data/orders'),
    children: await import('../src/lib/data/children'),
    users: await import('../src/lib/data/users'),
  };
});

after(async () => {
  if (skip || !deps) return;
  const { inArray } = await import('drizzle-orm');
  // Orders first: created_by_id is ON DELETE SET NULL, so deleting the user would
  // leave the order behind and the next verify run would report a phantom orphan.
  if (createdOrderIds.length > 0) {
    await deps.db.delete(deps.schema.orders).where(inArray(deps.schema.orders.id, createdOrderIds));
  }
  if (createdChildIds.length > 0) {
    await deps.db.delete(deps.schema.children).where(inArray(deps.schema.children.id, createdChildIds));
  }
  if (createdUserIds.length > 0) {
    await deps.db.delete(deps.schema.users).where(inArray(deps.schema.users.id, createdUserIds));
  }
});

function uid(): string {
  const id = `test-${randomBytes(8).toString('hex')}`;
  createdUserIds.push(id);
  return id;
}

function childId(): string {
  const id = `c-${randomBytes(6).toString('hex')}`;
  createdChildIds.push(id);
  return id;
}

function orderId(): string {
  const id = `o-${randomBytes(6).toString('hex')}`;
  createdOrderIds.push(id);
  return id;
}

/**
 * Drizzle wraps driver errors, so the Postgres constraint name sits in
 * `error.cause`, not in the top-level message. Flatten the chain before matching,
 * otherwise an assertion can pass or fail for the wrong reason.
 */
async function rejectionText(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const parts: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    }
    return parts.join(' | ');
  }
  throw new assert.AssertionError({ message: 'expected the query to be rejected' });
}

test('a migrated Firebase account logs in and is upgraded in place', { skip }, async () => {
  const { db, schema, password } = deps;
  const { eq } = await import('drizzle-orm');

  // Exactly what migrate-auth.ts writes: the Firebase hash and salt, no hash of
  // our own.
  process.env.FIREBASE_HASH_SIGNER_KEY =
    'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==';
  process.env.FIREBASE_HASH_SALT_SEPARATOR = 'Bw==';
  process.env.FIREBASE_HASH_ROUNDS = '8';
  process.env.FIREBASE_HASH_MEM_COST = '14';

  const id = uid();
  await db.insert(schema.users).values({
    id,
    email: `${id}@example.test`,
    legacyFirebaseHash:
      'lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==',
    legacyFirebaseSalt: '42xEC+ixf3L2lw==',
  });

  const [stored] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  assert.ok(stored);

  const first = await password.verifyPassword('user1password', stored);
  assert.equal(first.ok, true, 'the original Firebase password must be accepted');
  assert.ok(first.ok && first.rehashTo, 'and must yield an upgraded hash');

  // Apply the upgrade the way loginAction does.
  await db
    .update(schema.users)
    .set({
      passwordHash: first.ok ? first.rehashTo : null,
      legacyFirebaseHash: null,
      legacyFirebaseSalt: null,
    })
    .where(eq(schema.users.id, id));

  const [upgraded] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  assert.ok(upgraded);
  assert.equal(upgraded.legacyFirebaseHash, null, 'the Firebase hash must be gone after upgrade');
  assert.ok(upgraded.passwordHash?.startsWith('scrypt$'));

  // The same password still works, now through our own hash, and the Firebase
  // parameters are no longer consulted.
  delete process.env.FIREBASE_HASH_SIGNER_KEY;
  delete process.env.FIREBASE_HASH_SALT_SEPARATOR;
  const second = await password.verifyPassword('user1password', upgraded);
  assert.deepEqual(second, { ok: true, rehashTo: null });

  const wrong = await password.verifyPassword('user1passwor', upgraded);
  assert.equal(wrong.ok, false);
});

test('email uniqueness is case-insensitive', { skip }, async () => {
  const { db, schema } = deps;
  const id = uid();
  const email = `Mixed.Case.${randomBytes(4).toString('hex')}@Example.Test`;

  await db.insert(schema.users).values({ id, email });

  const text = await rejectionText(() =>
    db.insert(schema.users).values({ id: uid(), email: email.toLowerCase() }),
  );
  assert.match(
    text,
    /duplicate key|users_email_lower_idx/i,
    'two accounts must not be able to claim the same address in different casing',
  );
});

test('order constraints reject bad data', { skip }, async () => {
  const { db, schema, orders } = deps;
  const userId = uid();
  await db.insert(schema.users).values({ id: userId, email: `${userId}@example.test` });

  const child = childId();
  await db.insert(schema.children).values({ id: child, name: 'Test', surname: 'Kind', classroom: 'L3' });
  await db.insert(schema.childParents).values({ childId: child, userId });

  // The casing bug the old app shipped: 'Gym t-shirt' is now impossible to store.
  assert.match(
    await rejectionText(() =>
      db.insert(schema.orders).values({
        id: randomBytes(6).toString('hex'),
        orderType: 'Gym t-shirt',
        createdById: userId,
        createdForId: child,
      }),
    ),
    /orders_type_valid/,
  );

  assert.match(
    await rejectionText(() =>
      db.insert(schema.orders).values({
        id: randomBytes(6).toString('hex'),
        orderType: 'Drankkaart',
        status: 'Onbekend',
        createdById: userId,
        createdForId: child,
      }),
    ),
    /orders_status_valid/,
  );

  assert.match(
    await rejectionText(() =>
      db.insert(schema.orders).values({
        id: randomBytes(6).toString('hex'),
        orderType: 'Drankkaart',
        quantity: 0,
        createdById: userId,
        createdForId: child,
      }),
    ),
    /orders_quantity_positive/,
  );

  assert.match(
    await rejectionText(() =>
      db.insert(schema.children).values({
        id: randomBytes(6).toString('hex'),
        name: 'X',
        classroom: 'L9',
      }),
    ),
    /children_classroom_valid/,
  );

  // And the correct casing must of course still be storable.
  const okId = orderId();
  await db.insert(schema.orders).values({
    id: okId,
    orderType: 'Gym T-shirt',
    size: 'M',
    createdById: userId,
    createdForId: child,
    createdForClassroom: 'L3',
  });
  const stored = await orders.getOrder(okId);
  assert.equal(stored?.orderType, 'Gym T-shirt');
});

test('a child links to both parents and survives one of them leaving', { skip }, async () => {
  const { db, schema, children } = deps;
  const { and, eq } = await import('drizzle-orm');

  const parentA = uid();
  const parentB = uid();
  await db.insert(schema.users).values([
    { id: parentA, email: `${parentA}@example.test` },
    { id: parentB, email: `${parentB}@example.test` },
  ]);

  const child = childId();
  await db.insert(schema.children).values({ id: child, name: 'Renée', surname: 'Test', classroom: 'KK0' });
  await db.insert(schema.childParents).values([
    { childId: child, userId: parentA },
    { childId: child, userId: parentB },
  ]);

  assert.equal((await children.listChildrenForParent(parentA)).length, 1);
  assert.equal((await children.listChildrenForParent(parentB)).length, 1);
  assert.deepEqual(await children.classroomsForParent(parentA), ['KK0']);
  assert.equal(await children.isParentOf(parentA, child), true);

  // Parent A removes the child from their own family.
  await db
    .delete(schema.childParents)
    .where(and(eq(schema.childParents.childId, child), eq(schema.childParents.userId, parentA)));

  assert.equal((await children.listChildrenForParent(parentA)).length, 0);
  assert.equal(
    (await children.listChildrenForParent(parentB)).length,
    1,
    "the other parent must keep the child",
  );
});

test('deleting a user keeps their posts but clears the author', { skip }, async () => {
  const { db, schema } = deps;
  const { eq, inArray } = await import('drizzle-orm');

  const authorId = `test-${randomBytes(8).toString('hex')}`;
  await db.insert(schema.users).values({ id: authorId, email: `${authorId}@example.test`, teacher: true });

  const postId = `p-${randomBytes(6).toString('hex')}`;
  await db
    .insert(schema.posts)
    .values({ id: postId, postTitle: 'Uitstap naar het bos', postUserId: authorId, classroom: ['L3'] });

  await db.delete(schema.users).where(inArray(schema.users.id, [authorId]));

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  assert.ok(post, 'the article must survive the author being deleted');
  assert.equal(post.postUserId, null);

  await db.delete(schema.posts).where(eq(schema.posts.id, postId));
});

test('CSV export escapes separators, quotes and newlines', { skip }, async () => {
  const { orders } = deps;
  const now = new Date('2026-03-04T09:30:00Z');

  const csv = orders.ordersToCsv([
    {
      id: 'o1',
      orderType: 'Drankkaart',
      status: 'Besteld',
      quantity: 2,
      createdById: 'u1',
      createdForId: 'c1',
      createdByName: 'Ann',
      createdBySurname: 'De Smet; Janssens',
      createdByEmail: 'ann@example.test',
      createdForName: 'Loes',
      createdForSurname: 'De "Grote"',
      createdForClassroom: 'L1',
      color: null,
      size: null,
      consumptionMonth: null,
      consumptionDates: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const lines = csv.split('\r\n');
  assert.ok(lines[0]?.startsWith('﻿Sint-Jorisschool'), 'must begin with a UTF-8 BOM for Excel');
  assert.equal(lines[2], 'Type;Besteldatum;LaatsteAanpassing;OuderNaam;OuderVoornaam;KindNaam;KindVoornaam;Klas;Status;Aantal;Kleur;Maat;MaaltijdMaand;MaaltijdData');

  const row = lines[3]!;
  assert.match(row, /"De Smet; Janssens"/, 'a semicolon in a name must be quoted, not shift the columns');
  assert.match(row, /"De ""Grote"""/, 'a quote must be doubled');
  // 14 columns, so 13 separators outside quoted cells.
  const separators = row.split('').reduce(
    (state, char) => {
      if (char === '"') return { ...state, inQuotes: !state.inQuotes };
      if (char === ';' && !state.inQuotes) return { ...state, count: state.count + 1 };
      return state;
    },
    { inQuotes: false, count: 0 },
  );
  assert.equal(separators.count, 13);
});

test('the admin count guard can see the real number of admins', { skip }, async () => {
  const { db, schema, users } = deps;
  const before = await users.countAdmins();

  const id = uid();
  await db.insert(schema.users).values({ id, email: `${id}@example.test`, admin: true });

  assert.equal(await users.countAdmins(), before + 1);
});

test('user search matches email, first name and surname', { skip }, async () => {
  const { db, schema, users } = deps;
  const id = uid();
  const token = randomBytes(4).toString('hex');

  await db.insert(schema.users).values({
    id,
    email: `zoek-${token}@example.test`,
    displayName: 'Vincent',
    surname: `Vandenberghe${token}`,
  });

  assert.equal((await users.searchUsers(token)).length, 1, 'by email fragment');
  assert.ok((await users.searchUsers(`Vandenberghe${token}`)).some((u) => u.id === id), 'by surname');
  // A % in the query must be treated as a literal, not a wildcard matching everyone.
  assert.equal((await users.searchUsers('%')).length, 0, 'LIKE metacharacters must be escaped');
});
