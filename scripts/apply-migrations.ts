/**
 * Applies every .sql file in db/migrations in filename order, once each,
 * tracked in a _migrations table. Uses the direct (unpooled) connection because
 * DDL and the pooler do not mix well.
 *
 *   npm run db:apply
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { connect } from './lib/pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

async function main() {
  // connect() refuses to proceed unless this is the school's own database. Our
  // table names are generic enough that running these migrations against another
  // project's database would otherwise half-succeed.
  const client = await connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query<{ filename: string }>('SELECT filename FROM _migrations');
  const done = new Set(rows.map((r) => r.filename));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Drizzle separates statements with this marker; plain files run as one block.
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  apply ${file} (${statements.length} statement(s))`);
    try {
      await client.query('BEGIN');
      for (const statement of statements) await client.query(statement);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`\nFailed on ${file}:\n`, error);
      process.exitCode = 1;
      await client.end();
      return;
    }
  }

  await client.end();
  console.log(`\nDone. ${applied} migration(s) applied, ${files.length - applied} already present.`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
