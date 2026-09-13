# Migration runbook: Firebase → Neon

The goal is that on the morning after the switch, parents log in with the password
they already have and notice nothing except a faster site.

This document is the order to do things in. Read it once end to end before
starting — step 2 is the one that decides whether the whole thing works, and it
needs something only you can get from the Firebase console.

---

## Before anything: close the open door

This is unrelated to the migration and more urgent than it.

`firebase/firestore.rules` in the old project grants, on every collection
including `Users`:

```
allow create: if true;
allow read:   if true;
allow write:  if true;
allow delete: if true;
```

The Firebase API key and project id are in the published JavaScript bundle. With
those two public values and the `firebase` npm package, anyone can read every
parent's email address and phone number, every child's name and classroom, and
every order — and delete all of it. For a school holding data about minors, that
is a reportable GDPR exposure, not a nice-to-have.

The rebuilt site does not use Firestore at all, so it is immune. But the old
project stays reachable until you delete it. **Do not wait for the migration.**
Replace the rules with a deny-all and deploy them as soon as the new site is live:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

```bash
firebase deploy --only firestore:rules
```

While the old site is still the live one, the rules have to stay open for it to
work — that is the reason to keep the cutover window short.

---

## Step 0 — Prepare

```bash
git clone <this repository> && cd sintjorisschool
npm install
mkdir -p migration-data          # gitignored; everything sensitive goes here
cp .env.example .env.local
```

### Create a separate Neon project

**A new project, not a new database inside an existing one.** If this account
already hosts another application, that distinction is the whole point.

Neon's hierarchy is organization → **project** → branch → database. Two databases
in one project still share:

- the same compute endpoint and hostname
- the same Postgres **roles** — so one leaked credential reaches both
- the same branch, so a branch reset or point-in-time restore for the other
  application rewinds this one too
- the same scale-to-zero compute, storage quota and PITR window

For data about minors, that shared credential surface is not an acceptable
boundary. A separate project gives independent endpoints, roles, branches, PITR
and a separate line on the bill.

> Neon console → **New project**
> - Name: `sintjorisschool`
> - Region: `eu-central-1` (Frankfurt) — closest to Belgium
> - Database name: `sintjorisschool`

Check your plan's project limit first; if you are on a plan that allows only one
project, the fallback is a separate database *plus* a dedicated role with
`CONNECT` revoked on the other database. That is weaker — same compute, same
branch lineage — so treat it as temporary.

Put both connection strings from the **new** project in `.env.local`:

- `DATABASE_URL` — the **pooled** string (host contains `-pooler`). The app uses it.
- `DATABASE_URL_UNPOOLED` — the direct string. Migrations and imports use it.

Double-check the hostname. It must be the new project's `ep-…`, not the other
application's.

### The guardrail, and why it exists

Every script in `scripts/` calls `assertTargetDatabase` before doing anything. It
prints the host, database and role it is about to touch, then refuses unless:

1. `current_database()` equals `EXPECTED_DATABASE_NAME` (default
   `sintjorisschool`), and
2. the `public` schema contains only this project's tables.

This is not paperwork. Five of our tables are called `users`, `posts`, `orders`,
`content` and `sessions` — the names almost any other application would also use.
A connection string pasted from the wrong Neon project would collide on some
tables and silently create the rest, scattering a school's schema through an
unrelated database. So it is checked up front instead of discovered later:

```
Target database
  host      ep-xxx.eu-central-1.aws.neon.tech
  database  sintjorisschool
  role      sintjorisschool_owner
  check     ok (0 table(s), all belonging to this project)
```

If you see a refusal, fix `DATABASE_URL` rather than reaching for
`--allow-any-database`. The override exists only for the case where the school's
database legitimately has a different name, and `EXPECTED_DATABASE_NAME` is the
better answer even then.

`drizzle-kit push` is deliberately **not** wired up as an npm script: it writes
DDL straight from `db/schema.ts` to whatever `DATABASE_URL` says, with no such
check. Use `npm run db:apply`.

Generate the session secret:

```bash
openssl rand -base64 48      # → SESSION_SECRET
```

Create the schema:

```bash
npm run db:apply
```

**Do it on a Neon branch first.** Neon branches are copy-on-write and cost almost
nothing, so create one called `migration-rehearsal`, run this whole document
against it, and only then repeat it against `main`. The first run always turns up
something about the real data that no amount of reading finds.

---

## Step 1 — Export from Firebase

```bash
npm install -g firebase-tools
firebase login
firebase use sintjorisschool-3390

firebase auth:export migration-data/firebase-users.json --format=json
```

`firebase-users.json` contains every account's password hash. Treat it like a
password file: it is already gitignored, keep it off shared drives and Slack, and
delete it when the migration is done.

Also download a service account key, used for Firestore and Storage:

> Firebase Console → Project settings → Service accounts → **Generate new private key**

Save it as `migration-data/serviceAccount.json`.

---

## Step 2 — The four values that make logins work  ⚠️

**If you get this wrong, every existing parent is locked out.** Nothing else in
this document matters as much.

Firebase does not store a plain password hash. It derives a key from the password
with scrypt, then uses that key to AES-256-CTR encrypt a project-wide "signer
key", and stores the result. To verify a password you need four project
parameters:

> Firebase Console → **Authentication** → **Users** tab → **⋮** menu at the top
> right of the user table → **Password hash parameters**

Copy all four into `.env.local`, complete, including any trailing `=` padding:

```dotenv
FIREBASE_HASH_SIGNER_KEY="…long base64…"
FIREBASE_HASH_SALT_SEPARATOR="Bw=="
FIREBASE_HASH_ROUNDS="8"
FIREBASE_HASH_MEM_COST="14"
```

Now prove it, using an account whose password you actually know — make a throwaway
account on the live site for this if you have to:

```bash
npm run auth:probe -- test-ouder@example.be 'the-password-you-set'
```

You are looking for:

```
  ✓ The password verifies.
```

**Do not proceed past a ✗.** The script prints what to check. The usual causes are
a truncated signer key, a copy that dropped the `=` padding, or parameters taken
from a different Firebase project than the export.

(The verification itself is covered by `test/password.test.ts`, which checks our
implementation against the published Firebase scrypt test vector. `npm test`
should pass before you start.)

---

## Step 3 — Import the accounts

```bash
npm run migrate:auth -- --dry-run     # read the report first
npm run migrate:auth
```

Each Firebase UID becomes the `users.id`, so every `DocumentReference` in the
Firestore data resolves without a translation table.

The report will name two kinds of account that cannot log in with a password:

- **No password hash.** They signed in with Google or Apple. Firebase never had a
  password for them, so neither can we. They use *wachtwoord vergeten* once and
  then have a real password. Tell them; it is a handful of people at most.
- **Duplicate email, differing only in case.** Postgres enforces one account per
  address case-insensitively; Firestore did not. Decide with the school which
  account is the real one before going live.

Then confirm the imported hashes verify *from the database*:

```bash
npm run auth:probe -- --from-db test-ouder@example.be 'the-password-you-set'
```

---

## Step 4 — Import the data

```bash
npm run migrate:firestore -- --dry-run
npm run migrate:firestore
```

This loads `Users` (enriching the rows from step 3), `Children`, `Posts`,
`Orders` and `Content`. Read the problem report; it is written to be acted on, not
skimmed. Expect to see some of:

- **Children with a classroom the new schema does not know.** Imported as `KK0`
  and listed by name. Fix them in the profile screen, or tell the parent to.
- **Children with no surviving parent link.** The old data kept references to
  deleted accounts. These pupils are imported but invisible until a parent adds
  them again.
- **Duplicate children.** Two parents who each added the same child get two
  records in the old data. They are imported as-is so no orders are lost; merging
  them is a manual decision.
- **Gym orders renamed.** See `docs/DECISIONS.md` — the old app wrote
  `Gym t-shirt` and queried `Gym T-shirt`, so those orders were invisible to
  everyone. The migration normalises the casing, which means **gym orders the
  school never knew about will appear.** Check them before invoicing.

---

## Step 5 — Verify

```bash
npm run migrate:verify
```

It compares Firestore document counts against Neon row counts and runs a set of
consistency checks. `users` legitimately having *more* rows than the Firestore
`Users` collection is expected: Firebase Auth can hold accounts that never got a
profile document.

Resolve every `✗`. Read every `!` and decide out loud that it is expected.

If there are no administrators yet:

```bash
npm run admin:grant -- directie@sintjorisschool.be
```

---

## Step 6 — Rehearse

Deploy to a preview URL with the migrated Neon branch and walk through it as a
real person:

- [ ] Log in as an existing parent **with their original password** (this is the
      whole point — use a real account, not a new one)
- [ ] Their children are listed, in the right classes
- [ ] Their past orders are listed
- [ ] Place one of each order type; cancel one
- [ ] The schoolkrant shows the right articles per class; photos load
- [ ] Log in as an administrator: the member list, each order tab, the CSV export
- [ ] Open the CSV in whatever the school actually uses, and check the accents
      (é, ë) and that no column has shifted
- [ ] Log in as a teacher: they see only their own class, and their export
      contains only their own class
- [ ] *Wachtwoord vergeten* delivers a real email and the new password works
- [ ] Check on a phone — most parents will be on one

Set `MAIL_DRIVER=smtp` and real SMTP credentials before testing the email, or the
mail is only logged to the console.

---

## Step 7 — Cut over

Keep the window short. There is no two-way sync: anything written on the old site
after the final import is lost unless you re-import.

1. Put the old site in read-only mode, or announce a 30-minute maintenance
   window. Easiest read-only switch: deploy the deny-all Firestore rules above —
   the Flutter app will fail to write.
2. Re-run the imports, so nothing from the last days is missed:
   ```bash
   npm run migrate:auth
   npm run migrate:firestore
   npm run migrate:verify
   ```
   Both are upsert-based and safe to re-run. `migrate:auth` will not push an
   account back onto its legacy hash if it has already logged in on the new site.
3. Point DNS (or the Firebase Hosting custom domain) at the new deployment.
4. Watch: can a real parent log in, and does `/admin` load.
5. Deploy the deny-all Firestore rules if you have not already.

### If it goes wrong

Point DNS back at Firebase Hosting and restore the old Firestore rules. The old
app and its data are untouched by everything above — the migration only ever reads
from Firebase. That is the whole rollback.

What you lose by rolling back is anything parents did on the new site in the
meantime. Within a short window, that is a handful of orders; write them down
from the Neon tables before reverting.

---

## Step 8 — After

**Leave Firebase Storage alone for now.** Post photos still point at
`firebasestorage.googleapis.com` and those URLs work on their own. When you want
to switch the Firebase project off entirely, configure the `S3_*` variables
(Cloudflare R2 is the cheapest sensible option) and run:

```bash
npm run migrate:storage -- --dry-run
npm run migrate:storage
npm run migrate:verify        # "Posts still pointing at Firebase Storage" must be 0
```

Then wait a few days before deleting the bucket: cached pages and shared Facebook
links may still use the old URLs.

**Watch the password migration drain.** `/admin` → *Ledenbeheer* marks accounts
that still carry a Firebase hash with *Oud wachtwoord*, and
`npm run migrate:verify` counts them. Each login converts one. Once the number is
small and stable, you can remove the `FIREBASE_HASH_*` variables — the remaining
accounts then have to use *wachtwoord vergeten*, which for people who have not
logged in for a year is reasonable. Do not remove them early: without them, a
legacy account with the correct password is refused.

**Delete the export files.**

```bash
rm -rf migration-data/
```

`firebase-users.json` is a password file. It should not outlive the migration.
