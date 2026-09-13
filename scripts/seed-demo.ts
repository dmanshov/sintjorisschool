/**
 * Fills a LOCAL database with believable data so the site can be clicked through
 * without touching production: two accounts, two children, a few orders, an
 * article and some CMS text.
 *
 *   npm run seed:demo
 *
 * Refuses to run against a Neon host, so it cannot be pointed at the live
 * database by accident. Everything it creates has an id starting with "demo-",
 * so `npm run seed:demo -- --clean` removes exactly what it added.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { hashPassword } from '../src/lib/auth/password';
import { connect } from './lib/pg';

const DEMO_PASSWORD = 'DemoWachtwoord123';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';
  if (/neon\.(tech|build)/.test(url)) {
    throw new Error(
      'DATABASE_URL points at Neon. This script is for local databases only — it would write ' +
        'demo accounts into production.',
    );
  }

  const clean = process.argv.includes('--clean');
  const client = await connect();

  try {
    if (clean) {
      await client.query(`DELETE FROM orders WHERE id LIKE 'demo-%'`);
      await client.query(`DELETE FROM posts WHERE id LIKE 'demo-%'`);
      await client.query(`DELETE FROM children WHERE id LIKE 'demo-%'`);
      await client.query(`DELETE FROM users WHERE id LIKE 'demo-%'`);
      console.log('\nDemo data removed.');
      return;
    }

    const passwordHash = await hashPassword(DEMO_PASSWORD);

    await client.query(
      `INSERT INTO users (id, email, display_name, surname, password_hash, admin, teacher, teacher_classroom)
       VALUES ('demo-parent', 'ouder@example.test',   'Ann',      'Peeters', $1, false, false, '{}'),
              ('demo-admin',  'directie@example.test','Directie', 'SJW',     $1, true,  false, '{}'),
              ('demo-teacher','juf@example.test',     'Isabelle', 'Lambeens',$1, false, true,  '{KK0}')
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [passwordHash],
    );

    await client.query(
      `INSERT INTO children (id, name, surname, classroom) VALUES
         ('demo-child-1', 'Renée', 'Peeters', 'KK0'),
         ('demo-child-2', 'Henri', 'Peeters', 'L1')
       ON CONFLICT (id) DO NOTHING`,
    );

    await client.query(
      `INSERT INTO child_parents (child_id, user_id) VALUES
         ('demo-child-1','demo-parent'), ('demo-child-2','demo-parent')
       ON CONFLICT DO NOTHING`,
    );

    await client.query(
      `INSERT INTO orders (id, order_type, status, quantity, created_by_id, created_for_id,
         created_by_name, created_by_surname, created_by_email,
         created_for_name, created_for_surname, created_for_classroom, color, size, consumption_month, consumption_dates)
       VALUES
         ('demo-order-1','Drankkaart','Besteld',    2,'demo-parent','demo-child-2','Ann','Peeters','ouder@example.test','Henri','Peeters','L1',  NULL, NULL, NULL, '{}'),
         ('demo-order-2','Gym T-shirt','Besteld',   1,'demo-parent','demo-child-1','Ann','Peeters','ouder@example.test','Renée','Peeters','KK0', NULL, '6',  NULL, '{}'),
         ('demo-order-3','Badmuts','Uitgedeeld',    1,'demo-parent','demo-child-2','Ann','Peeters','ouder@example.test','Henri','Peeters','L1',  'Blauw', NULL, NULL, '{}'),
         ('demo-order-4','Maaltijd','Besteld',      2,'demo-parent','demo-child-1','Ann','Peeters','ouder@example.test','Renée','Peeters','KK0', NULL, NULL, 'Oktober 2026', '{2026-10-06,2026-10-20}')
       ON CONFLICT (id) DO NOTHING`,
    );

    await client.query(
      `INSERT INTO posts (id, post_title, post_description, classroom, pinned, post_user_id, time_posted)
       VALUES
         ('demo-post-1','Uitstap naar de boerderij',
          E'De kleuters trokken naar de boerderij.\\n\\nWe mochten de kalfjes aaien en zagen hoe de koeien gemolken worden. Moe maar voldaan weer naar school!',
          '{KK0,KK1}', true, 'demo-teacher', now() - interval '2 days'),
         ('demo-post-2','Zwemmen in het derde leerjaar',
          'Vanaf volgende week zwemmen we elke donderdagvoormiddag. Vergeet de badmuts niet!',
          '{L3}', false, 'demo-admin', now() - interval '9 days'),
         ('demo-post-3','Voorleesweek in de leesklas',
          'Een week vol verhalen, met bezoek van een echte schrijver.',
          '{LEESKLAS}', false, 'demo-admin', now() - interval '20 days')
       ON CONFLICT (id) DO NOTHING`,
    );

    await client.query(
      `UPDATE content SET
         welkom = $1,
         maaltijd_maand = 'Oktober 2026',
         maaltijd_datums = '{2026-10-06,2026-10-13,2026-10-20,2026-10-27}',
         maaltijd_bericht = 'Warme maaltijden kosten €4,20. Bestel voor de 25e van de maand.',
         team_directeur = 'An Directeur',
         team_kleuterschool = E'Isabelle Lambeens — KK0\\nAnnick Schots — KK1\\nJori Van Geertruyden — KK2',
         bestuur_voorzitter = 'Jan Voorzitter',
         updated_at = now()
       WHERE id = 'singleton'`,
      [
        'Welkom op de website van de Sint-Jorisschool. Hier vind je alles over onze werking, ' +
          'onze visie en het dagelijkse leven op school.',
      ],
    );

    // Sessions, so the pages can be opened without going through the login form.
    const secret = process.env.SESSION_SECRET;
    if (secret) {
      await client.query(`DELETE FROM sessions WHERE user_id LIKE 'demo-%'`);
      console.log('\nSession cookies (name: sjs_session):');
      for (const userId of ['demo-parent', 'demo-admin', 'demo-teacher']) {
        const id = randomBytes(32).toString('base64url');
        await client.query(
          `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2, now() + interval '7 days')`,
          [id, userId],
        );
        const signature = createHmac('sha256', secret).update(id).digest('base64url');
        console.log(`  ${userId.padEnd(14)} ${id}.${signature}`);
      }
    }

    console.log(
      `\nAccounts (password "${DEMO_PASSWORD}"):\n` +
        '  ouder@example.test      parent with two children and four orders\n' +
        '  directie@example.test   administrator\n' +
        '  juf@example.test        teacher for KK0\n',
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
