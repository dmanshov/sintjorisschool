import { Client } from 'pg';
import '../load-env';

/**
 * A direct Postgres client for the migration scripts. Deliberately not the
 * app's Neon-HTTP handle: these scripts move tens of thousands of rows and want
 * one long-lived connection and real transactions, which is what the unpooled
 * connection string is for.
 */
export async function connect(): Promise<Client> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be set.');
  const client = new Client({ connectionString: url });
  await client.connect();
  await assertTargetDatabase(client, url);
  return client;
}

/**
 * Every table this project owns. Used to detect that DATABASE_URL is pointing at
 * somebody else's database.
 */
const OWNED_TABLES = new Set([
  'users',
  'children',
  'child_parents',
  'posts',
  'post_likes',
  'orders',
  'content',
  'sessions',
  'password_reset_tokens',
  'login_attempts',
  // Bookkeeping: ours, and drizzle-kit's if anyone has used db:push.
  '_migrations',
  '__drizzle_migrations',
]);

/**
 * Refuses to touch a database that does not look like this project's.
 *
 * The reason this exists: several of our table names — users, posts, orders,
 * content, sessions — are the names almost any other project would also use. A
 * connection string pasted from a different Neon project would either collide
 * loudly or, worse, succeed and quietly scatter a school's schema through an
 * unrelated application's database.
 *
 * Two checks:
 *   1. The database must be called what we expect (EXPECTED_DATABASE_NAME,
 *      default "sintjorisschool").
 *   2. The public schema must contain only tables we own. Anything else means
 *      this database belongs to something else.
 *
 * `--allow-any-database` overrides both, for the rare case where the school's
 * database genuinely has another name. It is deliberately verbose to type.
 */
export async function assertTargetDatabase(client: Client, url: string): Promise<void> {
  const expected = process.env.EXPECTED_DATABASE_NAME ?? 'sintjorisschool';
  const override = process.argv.includes('--allow-any-database');

  const { rows } = await client.query<{ database: string; role: string }>(
    'SELECT current_database() AS database, current_user AS role',
  );
  const database = rows[0]?.database ?? '(unknown)';
  const role = rows[0]?.role ?? '(unknown)';

  let host = '(unparseable host)';
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep the placeholder */
  }

  // Always say out loud what is about to be touched. A migration that silently
  // picks its target is a migration that eventually picks the wrong one.
  console.log(`\nTarget database\n  host      ${host}\n  database  ${database}\n  role      ${role}`);

  const tables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const foreign = tables.rows.map((r) => r.tablename).filter((name) => !OWNED_TABLES.has(name));

  if (override) {
    console.log('  check     SKIPPED (--allow-any-database)');
    if (foreign.length > 0) {
      console.log(`  warning   ${foreign.length} table(s) here belong to another project: ${foreign.slice(0, 8).join(', ')}`);
    }
    return;
  }

  if (database !== expected) {
    throw new Error(
      `Refusing to continue: connected to database "${database}", expected "${expected}".\n\n` +
        'This project must live in its own Neon project, separate from any other\n' +
        'application sharing the account. Check DATABASE_URL / DATABASE_URL_UNPOOLED\n' +
        'in .env.local.\n\n' +
        `If the school's database really is called "${database}", set\n` +
        `  EXPECTED_DATABASE_NAME="${database}"\n` +
        'in .env.local rather than passing --allow-any-database.',
    );
  }

  if (foreign.length > 0) {
    throw new Error(
      `Refusing to continue: the public schema of "${database}" contains ${foreign.length} table(s)\n` +
        `that do not belong to this project:\n  ${foreign.slice(0, 15).join(', ')}` +
        (foreign.length > 15 ? `, … and ${foreign.length - 15} more` : '') +
        '\n\nThat means DATABASE_URL points at another application\'s database. Our table\n' +
        'names (users, posts, orders, content, sessions) are generic enough to collide\n' +
        'with almost anything, so this is checked rather than discovered later.\n\n' +
        'Create a separate Neon project for the school and use its connection string.',
    );
  }

  console.log(`  check     ok (${tables.rows.length} table(s), all belonging to this project)`);
}

/** `--dry-run` anywhere in argv. */
export const isDryRun = process.argv.includes('--dry-run');

export function banner(title: string): void {
  console.log(`\n${'─'.repeat(72)}\n${title}${isDryRun ? '   [DRY RUN — nothing is written]' : ''}\n${'─'.repeat(72)}`);
}

export class Counter {
  private counts = new Map<string, number>();

  add(key: string, by = 1): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + by);
  }

  get(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  report(): void {
    console.log('');
    const width = Math.max(...[...this.counts.keys()].map((k) => k.length), 0);
    for (const [key, value] of this.counts) {
      console.log(`  ${key.padEnd(width)}  ${value}`);
    }
  }
}

/** Collects problems to print at the end rather than losing them in the scroll. */
export class Problems {
  private items: string[] = [];

  add(message: string): void {
    this.items.push(message);
  }

  get count(): number {
    return this.items.length;
  }

  report(limit = 40): void {
    if (this.items.length === 0) {
      console.log('\n  No problems found.');
      return;
    }
    console.log(`\n  ${this.items.length} problem(s):`);
    for (const item of this.items.slice(0, limit)) console.log(`    - ${item}`);
    if (this.items.length > limit) {
      console.log(`    … and ${this.items.length - limit} more.`);
    }
  }
}
