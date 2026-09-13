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
  return client;
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
