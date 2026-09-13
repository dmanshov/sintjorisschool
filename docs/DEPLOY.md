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
| `NEXT_PUBLIC_SITE_URL` | leave unset | Only needed to override the address the app derives from each request. See below — normally there is nothing to set here. |
| `SITE_ACCESS_CODE` | while testing | Puts the whole site behind a password prompt and marks it noindex. Remove it to go public. |
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

## 2b. Keep it private while you finish it

### What `NEXT_PUBLIC_SITE_URL` is, and is not

**Leave it unset. That is the normal, permanent setting** — not a placeholder
you fill in before going live.

The app needs an absolute URL in five places (the link inside a password-reset
email, `metadataBase` for Open Graph and canonical tags, `/sitemap.xml`, the
`Sitemap:` line in `/robots.txt`, and the structured data on `/contact`). It gets
one by reading the `Host` header off the actual incoming request
(`src/lib/site-url.ts`), so it is automatically correct on whatever address is
serving it: a preview URL, the `*.vercel.app` production URL, or a custom domain
later — with no code change and no environment variable to update when the
address changes. This is also why the codebase names no domain anywhere: there
is nothing to name.

`NEXT_PUBLIC_SITE_URL` exists only to override that, for the unusual case where a
proxy in front of the deployment strips the standard forwarded-host headers. It
does not publish anything, grant anyone access, or point a domain at this
deployment — only DNS does that. If you ever do set it, point it at wherever this
deployment actually answers; pointing it anywhere else sends password-reset links
to the wrong place, which is the one thing a wrong value here actually breaks.

### What actually makes the site visible

Two things, and neither is an environment variable:

1. **A custom domain attached in Vercel**, plus the DNS record pointing at it.
   Until you do that, the school's address is untouched.
2. **The `*.vercel.app` address itself**, which is public. A Vercel *production*
   deployment is reachable there by anyone who has the link, and unlike a preview
   deployment it is not automatically marked `noindex` — so a crawler that finds
   it can index your unfinished site, and that page can later compete with the
   school's real domain for the same content.

"Nobody knows the URL" is not access control. So:

### The staging lock

Set one variable in Vercel and redeploy:

```
SITE_ACCESS_CODE=<a passphrase you choose>
```

The entire site — pages, images, PDFs, sitemap, robots.txt — then answers `401`
with a browser password prompt. Any username works; the passphrase is the
password. Everything served carries `X-Robots-Tag: noindex, nofollow, noarchive`,
and `/robots.txt` becomes a flat `Disallow: /`.

`/api/health` stays open on purpose, so you can check a deploy without a browser.
It reveals no hostname, credentials or data.

To go public: **delete the variable and redeploy.** Nothing else changes, and
robots.txt and the sitemap go back to normal on their own.

> Changing an environment variable in Vercel does not affect the running
> deployment until you redeploy. Vercel → Deployments → ⋯ → Redeploy.

### Vercel's own Deployment Protection

`SITE_ACCESS_CODE` lives in the code and works on any Vercel plan, which is why
this repository ships it. Vercel also has its own protection, under
**Settings → Deployment Protection**, and the two stack without conflicting —
use both if your plan offers it:

- **Vercel Authentication.** Requires the visitor to sign in with a Vercel
  account that has access to the project. Strongest option, but a school
  contact who is not a Vercel user cannot get in at all, even with the right
  link — not a fit for testers outside your own team.
- **Password Protection.** One shared password for the deployment, no Vercel
  account needed. The closest Vercel equivalent to `SITE_ACCESS_CODE`.
  **Requires a paid plan** — not available on Hobby.

I have no access to your Vercel account or its API from this session, so I
cannot turn either of these on for you — set them from the dashboard if your
plan includes them. If you are on Vercel's free Hobby plan, neither is
available, and `SITE_ACCESS_CODE` is the whole answer, not a fallback.

### Two more ways a test can leak

- **Email.** Keep `MAIL_DRIVER=console` while testing. If you configure SMTP and
  then import the real Firebase accounts, a password-reset test can send a real
  email to a real parent about a site they have never heard of.
- **The old site.** It stays live and fully functional throughout, and it keeps
  its wide-open Firestore rules until you replace them. That is unrelated to this
  deployment and still needs doing — see `docs/MIGRATION.md`.

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

**Going public is removing one variable.** Remove `SITE_ACCESS_CODE`, redeploy,
and attach the school's domain in Vercel. `NEXT_PUBLIC_SITE_URL` needs no change
either way — password-reset links, the sitemap and the Open Graph tags pick up
the new domain from the request as soon as it starts serving traffic.

**Functions run in `fra1`.** `vercel.json` pins the region to Frankfurt because
the Neon project is in `eu-central-1`. Leaving it on a US default would send every
database query across the Atlantic and back, on every request.
