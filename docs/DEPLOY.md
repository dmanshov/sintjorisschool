# Deploying to Vercel

How to get this running at a URL you can open, and keep it deploying on every
push to `main`.

The order matters: **the database has to be migrated before the site shows
anything.** A fresh Neon database is empty, and an empty database means no
content, no articles and no accounts.

---

## 1. Point Vercel at the right branch

> Vercel project → **Settings → Git**
> - Production Branch: `main`
> - Connected repository: `dmanshov/sintjorisschool`

Every push to `main` then triggers a production deployment automatically. Pushes
to any other branch produce a preview deployment on its own URL, which is a good
place to try a risky change before it reaches the school.

---

## 2. Set the environment variables

> Vercel project → **Settings → Environment Variables**

Only these are read by the **running site**:

| Variable | Needed | Notes |
| --- | --- | --- |
| `DATABASE_URL` | always | Neon's **pooled** string (host contains `-pooler`). The Neon integration usually sets this for you — open it and confirm it is the pooled one. |
| `SESSION_SECRET` | always | `openssl rand -base64 48`. Changing it later logs everyone out. |
| `NEXT_PUBLIC_SITE_URL` | always | The public URL, no trailing slash. Password-reset links are built from it, so a wrong value sends parents to the wrong host. |
| `FIREBASE_HASH_SIGNER_KEY` | after the Firebase import | Without it, migrated parents are told their correct password is wrong. See `docs/MIGRATION.md`. |
| `FIREBASE_HASH_SALT_SEPARATOR` | after the Firebase import | |
| `FIREBASE_HASH_ROUNDS` | after the Firebase import | Usually `8`. |
| `FIREBASE_HASH_MEM_COST` | after the Firebase import | Usually `14`. |
| `MAIL_DRIVER`, `MAIL_FROM`, `SMTP_*` | before go-live | With the default `console`, password-reset mails are logged, never sent. |
| `S3_*`, `NEXT_PUBLIC_MEDIA_*` | optional | Only for uploading new photos and PDFs. Existing Firebase Storage URLs work without it. |

**Not needed in Vercel:** `DATABASE_URL_UNPOOLED`, `EXPECTED_DATABASE_NAME`,
`EXPECTED_DATABASE_HOST`, and every `FIREBASE_SERVICE_ACCOUNT_*` /
`FIREBASE_AUTH_EXPORT_*` value. Those are used only by the scripts you run from
your own machine.

### Watch for a shared `DATABASE_URL`

A `DATABASE_URL` defined at Vercel **team** level is inherited by new projects. If
another application defined one there, this deployment silently uses it. Set the
variable on *this project* and check that nothing shared overrides it — then
confirm with the health check in step 4.

---

## 3. Create the schema in the Neon database

This is the step that is easy to skip and guarantees an empty site. Run it from
your own machine; it is a one-off.

Take the **direct** (unpooled) connection string from the Neon project that is
connected to Vercel, then:

```bash
git checkout main && git pull
npm install

# Point at the Vercel/Neon database for this one command.
DATABASE_URL_UNPOOLED="postgresql://…@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
EXPECTED_DATABASE_NAME="neondb" \
npm run db:apply
```

### About `EXPECTED_DATABASE_NAME`

The guardrail refuses to touch any database that is not this project's, and it
defaults to expecting the name `sintjorisschool`. **Neon's Vercel integration
usually creates a database called `neondb`,** so without that override the script
will stop with:

```
Refusing to continue: connected to database "neondb", expected "sintjorisschool".
```

That is the guard doing its job, not a bug. Two ways forward — either is fine:

- Keep the name and set `EXPECTED_DATABASE_NAME="neondb"` in your local `.env.local`, or
- Create a database called `sintjorisschool` inside that same Neon project and
  point `DATABASE_URL` at it instead.

Once it runs, pin the endpoint so nothing else can ever be written to, by adding
to your local `.env.local`:

```dotenv
EXPECTED_DATABASE_NAME="neondb"                            # or sintjorisschool
EXPECTED_DATABASE_HOST="ep-xxx.eu-central-1.aws.neon.tech"
```

### Make yourself an administrator

You need an account first. Open the deployed site, register at `/login`, then:

```bash
DATABASE_URL_UNPOOLED="…" EXPECTED_DATABASE_NAME="neondb" \
  npm run admin:grant -- your-email@example.com
```

`/admin` is then reachable, and you can edit the site text at **Inhoud**.

---

## 4. Check it actually worked

```
https://<your-deployment>/api/health
```

| Response | Meaning |
| --- | --- |
| `{"status":"ok","schema":"present"}` | Everything is connected. |
| `{"status":"setup-required","schema":"missing"}` | The site is up but step 3 has not run against *this* database. |
| `{"status":"degraded","database":"unreachable"}` | `DATABASE_URL` is wrong, or Neon is unreachable. |

The endpoint reveals no hostname, credentials or data, so it is safe to leave
public and to point uptime monitoring at.

The site itself does not hide these states. With no schema it still renders, with
an amber banner saying it is not set up yet; with the database unreachable it
renders the school's address, vision and contact details and says the rest is
temporarily unavailable. Both are logged at error level, visible in
**Vercel → Deployments → Logs**.

---

## 5. What you will see on the first visit

A working site with **no news articles and empty editable text**, because the
database is empty. That is correct, not broken. The pages fall back to their
built-in Dutch copy, and the parts that come from the database fill in when you
either:

- edit them at `/admin` → **Inhoud**, or
- run the Firebase import in `docs/MIGRATION.md`, which brings across the real
  content, parents, children, orders and articles.

To click through a realistic site before importing anything, seed a **local**
database instead — `npm run seed:demo` refuses to run against Neon on purpose.

---

## Notes on how this is set up

**The build never touches the database.** Every page is `force-dynamic`, so
nothing is prerendered at build time. A deploy therefore cannot fail because the
database is cold, empty or briefly unreachable — it fails only if the code fails
to compile. The trade is that pages are rendered per request; for a school site's
traffic that is the right way round.

**Migrations are not run during the build.** Putting `db:apply` in the build
command would make deploys depend on the database again, and two concurrent
builds would race each other. Schema changes are rare enough to run deliberately:
`npm run db:generate` after editing `db/schema.ts`, commit the SQL, then
`npm run db:apply` against Neon.

**Functions run in `fra1`.** `vercel.json` pins the region to Frankfurt because
the Neon project is in `eu-central-1`. Leaving it on a US default would send every
database query across the Atlantic and back, on every request.
