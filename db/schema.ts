/**
 * Neon Postgres schema for Sint-Jorisschool.
 *
 * Shape notes, because this is a migration and not a greenfield design:
 *
 * 1. Primary keys are `text`, not `uuid`/`serial`. They carry the original
 *    Firestore document IDs. That is deliberate: `users.id` equals the Firebase
 *    Auth UID (FlutterFlow stored user docs at `Users/{uid}`), so every
 *    DocumentReference in the old data resolves to a row without a lookup table,
 *    and any URL or export anyone already holds still points at the same record.
 *
 * 2. Firestore arrays-of-DocumentReference become real junction tables
 *    (`child_parents`, `post_likes`) with foreign keys and cascades. Firestore
 *    let those arrays hold references to deleted documents; Postgres will not.
 *
 * 3. Firestore arrays-of-string stay as Postgres `text[]` (classrooms,
 *    consumption dates). They are read as a whole, never joined on.
 *
 * 4. `content` is a single row. It was a single Firestore document in a
 *    `Content` collection, edited field-by-field from the admin screen.
 */
import {
  boolean,
  check,
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** Classrooms a child can be enrolled in. */
export const CLASSROOMS = [
  'KK0',
  'KK1',
  'KK2',
  'KK3',
  'L1',
  'L2A',
  'L2B',
  'L3',
  'L4',
  'L5A',
  'L5B',
  'L6',
] as const;

/** Classrooms a schoolkrant article can be tagged with (adds the reading class). */
export const POST_CLASSROOMS = [...CLASSROOMS, 'LEESKLAS'] as const;

/**
 * Order types, exactly as the old app wrote them to Firestore — with one fix.
 * The Flutter app created gym orders as 'Gym t-shirt' (lower-case t) but every
 * query that listed them, in both the parent and admin screens, filtered on
 * 'Gym T-shirt'. Every gym order ever placed was therefore invisible to
 * everyone. The migration normalises the casing; the CHECK constraint below
 * keeps it from recurring.
 */
export const ORDER_TYPES = ['Drankkaart', 'Badmuts', 'Gym T-shirt', 'Maaltijd'] as const;

/** 'Besteld' = placed, still to distribute. 'Uitgedeeld' = handed out, to invoice. */
export const ORDER_STATUSES = ['Besteld', 'Uitgedeeld', 'Gefactureerd'] as const;

export const BADMUTS_COLORS = ['Rood', 'Blauw', 'Geel', 'Groen', 'Oranje'] as const;
export const GYM_SIZES = ['4', '6', '8', '10', '12', '14', 'S', 'M', 'L', 'XL'] as const;

export type Classroom = (typeof CLASSROOMS)[number];
export type PostClassroom = (typeof POST_CLASSROOMS)[number];
export type OrderType = (typeof ORDER_TYPES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// users — one row per parent/teacher/admin account. id == Firebase Auth UID.
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: text().primaryKey(),
    email: text().notNull(),
    displayName: text(),
    surname: text(),
    phoneNumber: text(),
    photoUrl: text(),
    admin: boolean().notNull().default(false),
    teacher: boolean().notNull().default(false),
    teacherClassroom: text().array().notNull().default(sql`'{}'::text[]`),

    /**
     * Password material. Exactly one of these two is set for an account that can
     * log in with a password.
     *
     * `passwordHash` is our own format: scrypt$N$r$p$<saltB64>$<keyB64>.
     *
     * `legacyFirebaseHash` / `legacyFirebaseSalt` are carried over verbatim from
     * `firebase auth:export`. On the first successful login they are verified
     * with Firebase's modified-scrypt, then cleared and replaced by
     * `passwordHash` — the user never notices, and within a few weeks of normal
     * traffic almost no legacy hashes remain. See src/lib/auth/password.ts.
     */
    passwordHash: text(),
    legacyFirebaseHash: text(),
    legacyFirebaseSalt: text(),

    emailVerified: boolean().notNull().default(false),
    disabled: boolean().notNull().default(false),
    createdTime: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Email is the login identifier, so it must be unique and case-insensitive.
    // Firestore enforced neither; the migration reports collisions rather than
    // silently dropping an account.
    uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
    index('users_admin_idx').on(t.admin).where(sql`${t.admin}`),
    index('users_teacher_idx').on(t.teacher).where(sql`${t.teacher}`),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// children — a pupil. Linked to one or more parent accounts.
// ─────────────────────────────────────────────────────────────────────────────
export const children = pgTable(
  'children',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    surname: text().notNull().default(''),
    classroom: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('children_classroom_idx').on(t.classroom),
    check(
      'children_classroom_valid',
      sql`${t.classroom} = ANY (ARRAY['KK0','KK1','KK2','KK3','L1','L2A','L2B','L3','L4','L5A','L5B','L6'])`,
    ),
  ],
);

export const childParents = pgTable(
  'child_parents',
  {
    childId: text()
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.childId, t.userId] }), index('child_parents_user_idx').on(t.userId)],
);

// ─────────────────────────────────────────────────────────────────────────────
// posts — schoolkrant articles.
// ─────────────────────────────────────────────────────────────────────────────
export const posts = pgTable(
  'posts',
  {
    id: text().primaryKey(),
    postTitle: text().notNull().default(''),
    postDescription: text().notNull().default(''),
    postPhoto: text(),
    albumUrl: text(),
    externalUrl: text(),
    /** Which classrooms the article is about. Empty means it was never tagged. */
    classroom: text().array().notNull().default(sql`'{}'::text[]`),
    pinned: boolean().notNull().default(false),
    /**
     * Author. Nullable and ON DELETE SET NULL: Firestore kept post_user
     * references to accounts that no longer existed, and deleting a teacher
     * must not delete the school newspaper.
     */
    postUserId: text().references(() => users.id, { onDelete: 'set null' }),
    timePosted: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('posts_time_posted_idx').on(t.timePosted.desc()),
    index('posts_pinned_time_idx').on(t.pinned.desc(), t.timePosted.desc()),
    // GIN index so "articles for classroom L3" stays a single index scan.
    index('posts_classroom_gin_idx').using('gin', t.classroom),
  ],
);

export const postLikes = pgTable(
  'post_likes',
  {
    postId: text()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index('post_likes_user_idx').on(t.userId)],
);

// ─────────────────────────────────────────────────────────────────────────────
// orders — drink cards, swim caps, gym shirts, hot meals.
//
// The denormalised *_name / *_surname / *_classroom / *_email columns are kept
// on purpose. They are a historical record: the CSV the school invoices from
// must show the child's classroom as it was when the order was placed, not as
// it is today after the child moved up a year.
// ─────────────────────────────────────────────────────────────────────────────
export const orders = pgTable(
  'orders',
  {
    id: text().primaryKey(),
    orderType: text().notNull(),
    status: text().notNull().default('Besteld'),
    quantity: doublePrecision().notNull().default(1),

    createdById: text().references(() => users.id, { onDelete: 'set null' }),
    createdForId: text().references(() => children.id, { onDelete: 'set null' }),

    createdByName: text(),
    createdBySurname: text(),
    createdByEmail: text(),
    createdForName: text(),
    createdForSurname: text(),
    createdForClassroom: text(),

    /** Badmuts only. */
    color: text(),
    /** Gym T-shirt only. */
    size: text(),
    /** Maaltijd only: which month, and which dates within it were chosen. */
    consumptionMonth: text(),
    consumptionDates: text().array().notNull().default(sql`'{}'::text[]`),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('orders_type_status_idx').on(t.orderType, t.status),
    index('orders_created_by_idx').on(t.createdById, t.createdAt.desc()),
    index('orders_created_for_idx').on(t.createdForId),
    index('orders_classroom_idx').on(t.createdForClassroom),
    index('orders_month_idx').on(t.consumptionMonth),
    check(
      'orders_type_valid',
      sql`${t.orderType} = ANY (ARRAY['Drankkaart','Badmuts','Gym T-shirt','Maaltijd'])`,
    ),
    check(
      'orders_status_valid',
      sql`${t.status} = ANY (ARRAY['Besteld','Uitgedeeld','Gefactureerd'])`,
    ),
    check('orders_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// content — the editable CMS text. One row, id 'singleton'.
// ─────────────────────────────────────────────────────────────────────────────
export const content = pgTable('content', {
  id: text().primaryKey().default('singleton'),

  /** Hot meals: uploaded menu PDFs (newest last), orderable dates, month, notice. */
  maaltijd: text().array().notNull().default(sql`'{}'::text[]`),
  maaltijdDatums: text().array().notNull().default(sql`'{}'::text[]`),
  maaltijdMaand: text(),
  maaltijdBericht: text(),

  inschrijvingen: text(),
  welkom: text(),
  schoolreglement: text(),

  teamFoto: text(),
  teamDirecteur: text(),
  teamAdministratie: text(),
  teamKleuterschool: text(),
  teamLagereSchool: text(),
  teamAmbulant: text(),
  teamZorg: text(),
  teamGym: text(),
  teamOnderhoud: text(),

  benodigdhedenKK0: text('benodigdheden_kk0'),
  benodigdhedenKK1: text('benodigdheden_kk1'),
  benodigdhedenKK2: text('benodigdheden_kk2'),
  benodigdhedenKK3: text('benodigdheden_kk3'),
  benodigdhedenL1: text('benodigdheden_l1'),
  benodigdhedenL2: text('benodigdheden_l2'),
  benodigdhedenL3: text('benodigdheden_l3'),
  benodigdhedenL4: text('benodigdheden_l4'),
  benodigdhedenL5: text('benodigdheden_l5'),
  benodigdhedenL6: text('benodigdheden_l6'),

  bestuurVoorzitter: text(),
  bestuurLeden: text(),

  ondersteuningVestiging: text(),
  ondersteuningVoorwaarden: text(),

  ziekte: text(),
  opvang: text(),

  clbCoordinator: text(),
  clbMedewerkers: text(),

  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedById: text().references(() => users.id, { onDelete: 'set null' }),
});

// ─────────────────────────────────────────────────────────────────────────────
// sessions — server-side session store. Firebase Auth held sessions in the
// browser; we hold an opaque id in an HttpOnly cookie and the truth here, so a
// session can actually be revoked (an admin losing a laptop, say).
// ─────────────────────────────────────────────────────────────────────────────
export const sessions = pgTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userAgent: text(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

// ─────────────────────────────────────────────────────────────────────────────
// password_reset_tokens — single-use, short-lived. Only the hash is stored, so
// a database leak cannot be turned into account takeover.
// ─────────────────────────────────────────────────────────────────────────────
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    tokenHash: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('prt_user_idx').on(t.userId), index('prt_expires_idx').on(t.expiresAt)],
);

// ─────────────────────────────────────────────────────────────────────────────
// login_attempts — rate limiting. The old site had none: an attacker could
// hammer Firebase Auth as fast as the network allowed.
// ─────────────────────────────────────────────────────────────────────────────
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: text().primaryKey(),
    /** Lower-cased email, or "ip:1.2.3.4" — whichever bucket is being counted. */
    bucket: text().notNull(),
    attemptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    succeeded: boolean().notNull().default(false),
  },
  (t) => [index('login_attempts_bucket_idx').on(t.bucket, t.attemptedAt.desc())],
);

export type User = typeof users.$inferSelect;
export type Child = typeof children.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Content = typeof content.$inferSelect;
export type Session = typeof sessions.$inferSelect;
