# Sint-Jorisschool — website and parent portal

The website of the Sint-Jorisschool in Tielt-Winge, rebuilt from the FlutterFlow
app onto Next.js and **Neon Postgres** instead of Firebase/Firestore.

Everything the old app did is here: the public pages, the schoolkrant, parent
profiles with children and the four order flows (drink cards, swim caps, gym
shirts, hot meals), the teacher and admin screens, the editable site text, and
the CSV export the school invoices from.

- **Stack** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4,
  Drizzle ORM, Neon Postgres. No Firebase at runtime.
- **Language** — the interface is Dutch. Code, comments and commits are English.
- **URLs** — unchanged from the old site (`/onzeSchool`, `/praktisch`,
  `/schoolkrant`, `/profiel`, `/admin`, …), so existing links, bookmarks,
  Facebook posts and search results keep working.

## Migrating from Firebase

**Read [`docs/MIGRATION.md`](docs/MIGRATION.md) before touching production.** The
short version: existing parents keep their current password. Firebase's password
hashes are carried over and verified with Firebase's own modified-scrypt, then
silently upgraded on each user's first login. That only works if you copy four
values out of the Firebase console first, and `npm run auth:probe` proves it
before you cut over.

## Quick start

```bash
npm install
cp .env.example .env.local          # then fill in DATABASE_URL and SESSION_SECRET

npm run db:apply                    # create the schema
npm run seed:demo                   # optional: believable local data
npm run dev                         # http://localhost:3000
```

`SESSION_SECRET` can be generated with `openssl rand -base64 48`.

For local work you do not need a Neon account: any `postgresql://localhost/...`
connection string makes the app use node-postgres instead of Neon's HTTP driver.
The query code is identical either way.

The demo seed creates three accounts, all with password `DemoWachtwoord123`:

| Email | Role |
| --- | --- |
| `ouder@example.test` | parent, two children, four orders |
| `directie@example.test` | administrator |
| `juf@example.test` | teacher for KK0 |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests, plus integration tests when `DATABASE_URL` is set |
| `npm run db:generate` | Regenerate SQL from `db/schema.ts` after a schema change |
| `npm run db:apply` | Apply pending migrations from `db/migrations` (checks it is the right database first) |
| `npm run db:studio` | Drizzle Studio, to browse the database |
| `npm run seed:demo` | Local demo data (`-- --clean` removes it) |
| `npm run admin:grant -- <email>` | Make someone an administrator (`-- --revoke` undoes it) |
| `npm run auth:probe -- <email> <password>` | Prove the Firebase hash parameters work |
| `npm run migrate:auth` | Firebase Auth accounts → Neon |
| `npm run migrate:firestore` | Firestore documents → Neon |
| `npm run migrate:storage` | Firebase Storage files → S3-compatible storage |
| `npm run migrate:verify` | Reconcile Firebase against Neon and report problems |

Every `migrate:*` script accepts `-- --dry-run`, which reads everything, reports
what it would do and writes nothing.

## Layout

```
db/
  schema.ts              Tables, constraints, and the classroom/order vocabularies
  migrations/            Generated SQL, applied in filename order
src/
  app/                   One directory per route; route names match the old site
  components/            Shared UI. Server components unless they need state
  lib/
    auth/                Passwords (incl. Firebase compatibility), sessions, rate limiting
    data/                Read queries
    actions/             Server actions — every mutation, with its authorisation
    site.ts              Addresses, phone numbers, teacher mailboxes, links
    copy.ts              Long-form page text that was hard-coded in the Dart widgets
    storage.ts           S3-compatible uploads
scripts/                 Migration and operational scripts
test/                    Unit and integration tests
```

## How content is edited

Text the school changes itself lives in one `content` row and is edited at
`/admin` → *Inhoud*: the welcome text, the team lists, the school board, CLB, the
supply list per classroom, the meal month and notice. Newlines are preserved as
typed.

Text that only changes when the site is redesigned (the vision statements, the
ouderraad description, the insurance explanation) lives in `src/lib/copy.ts`, and
the school's address, phone numbers and teacher mailboxes live in
`src/lib/site.ts`. A typo in a phone number should show up in a diff.

## Deploying

Any host that runs Next.js works. On Vercel: connect the repository, set the
environment variables from `.env.example`, and point `DATABASE_URL` at Neon's
**pooled** connection string (the one with `-pooler` in the host).

This site belongs in **its own Neon project**, not a second database inside a
project shared with another application — databases in one project share the
compute endpoint, the Postgres roles, the branch and the PITR window, so one
leaked credential reaches both. `docs/MIGRATION.md` covers the setup.

Every script refuses to run against anything but this project's own database. It
prints the host, database and role it is about to touch, then checks the database
name (`EXPECTED_DATABASE_NAME`), that the schema holds only our tables, and — once
you set it — that the endpoint host matches `EXPECTED_DATABASE_HOST`. Set that pin
as soon as the Neon project exists: it is what makes "this project and no other"
categorical rather than name-based.

Set `DATABASE_URL_UNPOOLED` to the direct connection string as well — migrations
and the import scripts use it, because DDL and bulk loads do not belong on a
connection pooler.

## Security notes

Two things are deliberately different from the old app:

1. **No database credential reaches the browser.** The old Firestore rules were
   `allow read, write, delete: if true` on every collection, so anyone with the
   API key from the JS bundle could read or delete every parent, child and order.
   Here the browser talks only to this app, and every mutation re-checks
   permissions server-side in the same request that performs the write.

2. **Sessions are revocable.** They live in the `sessions` table behind an
   HttpOnly, signed cookie, so blocking an account logs it out everywhere
   immediately.

Login is rate-limited per email address and per IP. Password reset tokens are
stored only as a SHA-256 hash, are single-use, expire after an hour, and
invalidate every existing session for that account when used.
