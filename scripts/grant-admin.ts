/**
 * Grants (or revokes) administrator rights from the command line.
 *
 * Needed at least once: the admin screen is the only place rights can be changed,
 * and you cannot reach it until somebody is an admin.
 *
 *   npm run admin:grant -- directie@sintjorisschool.be
 *   npm run admin:grant -- directie@sintjorisschool.be --revoke
 */
import { connect } from './lib/pg';

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((a) => !a.startsWith('--'))?.toLowerCase();

  if (!email) {
    console.error('Usage: npm run admin:grant -- <email> [--revoke]');
    process.exit(1);
  }

  const client = await connect();
  try {
    if (revoke) {
      const { rows } = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM users WHERE admin AND lower(email) <> $1',
        [email],
      );
      if (Number(rows[0]?.count ?? 0) === 0) {
        console.error(
          `\nRefusing to revoke: ${email} would leave the site with no administrator at all.`,
        );
        process.exit(1);
      }
    }

    const { rows } = await client.query<{ email: string; admin: boolean }>(
      'UPDATE users SET admin = $2, updated_at = now() WHERE lower(email) = $1 RETURNING email, admin',
      [email, !revoke],
    );

    if (rows.length === 0) {
      console.error(`\nNo user with email ${email}. They must create a profile first.`);
      process.exit(1);
    }

    console.log(`\n${rows[0]!.email} is ${rows[0]!.admin ? 'now an administrator' : 'no longer an administrator'}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
