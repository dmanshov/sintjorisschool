# What changed, and why

A record of the decisions taken while rebuilding the FlutterFlow app, and of the
bugs found in it along the way. Written for whoever maintains this next.

---

## Bugs in the old app that this rebuild fixes

### 1. Every gym T-shirt order was invisible to everyone

`lib/pages/profiel/profiel_widget.dart:3306` created orders with:

```dart
orderType: 'Gym t-shirt',      // lower-case t
```

Every query that listed them — the parent's own "laatste 5 bestellingen" at
`profiel_widget.dart:3430` and all four admin queries at
`admin_widget.dart:3478`, `3525`, `3599` and the export — filtered on:

```dart
isEqualTo: 'Gym T-shirt',      // capital T
```

Firestore string equality is case-sensitive, so **no gym T-shirt order ever
appeared anywhere**: not to the parent who placed it, not to the teacher who was
meant to hand it out, not in the export the school invoices from. Parents ordered
shirts that were never delivered and never billed.

The migration normalises the casing, so those orders appear for the first time. A
`CHECK` constraint on `orders.order_type` now makes the mismatch impossible to
reintroduce, and `test/database.test.ts` asserts that `'Gym t-shirt'` is rejected.

**Check the gym orders that surface before invoicing anyone.** Some may be years
old and no longer wanted.

### 2. The gym order list showed the colour instead of the size

The same section rendered `listViewGymOrdersRecord.color` for gym orders, which is
the swim-cap field and is always empty for a shirt. Even with the casing fixed, a
parent would have seen "besteld op 3/9" with no size. Gym orders now show their
size, swim caps their colour.

### 3. The CSV export corrupted itself on any name containing a separator

`downloadOrdersAsCSV` concatenated fields with `;` and no escaping. One child
named `De Smet; Janssens` shifted every following column by one for that row —
silently, in the file the school invoices from. Values are now quoted and embedded
quotes doubled, which `test/database.test.ts` asserts. The file also gets a UTF-8
BOM, so Excel on Windows stops turning `Renée` into `RenÃ©e`.

### 4. "At least one admin must remain" was enforced in the browser

`edit_user_rights_widget.dart` counted admins client-side before allowing the last
one to be demoted. Two tabs open, or a direct Firestore write, went straight past
it — and with the rules below, a direct write was available to anybody. The check
now runs on the server inside the same request as the write.

### 5. Orders were attributed by the client

The Flutter app sent `created_by_name`, `created_for_classroom` and friends from
the browser. Combined with open rules, anyone could post an order attributed to
another family. Those fields are now filled server-side from the child record; the
form only says *which* child, and the server checks the submitter is that child's
parent.

### 6. The Cloud Function meant to clean up deleted users did nothing

`firebase/functions/index.js`:

```js
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  let firestore = admin.firestore();
  let userRef = firestore.doc("Users/" + user.uid);    // ...and then nothing
});
```

It looked up the document and returned. So deleting an account from Firebase Auth
left its `Users` document, its children's `parents` references, its orders and its
post likes pointing at a user that no longer existed. That is where the dangling
references the migration reports come from. Real foreign keys with explicit
`ON DELETE` behaviour now make this structural: children cascade, posts keep their
content and lose their author, orders keep their historical record.

---

## The security hole

The old `firestore.rules` granted `allow create, read, write, delete: if true` on
`Users`, `Children`, `Orders`, `Posts` and `Content`. With the API key and project
id from the published JavaScript bundle, anyone could read every parent's email
and phone number, every child's name and classroom, and every order, and delete
all of it.

This was not a consequence of using Firebase. It was the default FlutterFlow
generates when you do not write rules, and it shipped.

The rebuild removes the class of problem rather than patching it: no database
credential reaches the browser, and authorisation lives in
`src/lib/actions/*` next to each write. See `docs/MIGRATION.md` for what to do
about the old project, which stays exposed until its rules are replaced.

---

## Design decisions

### Firestore document IDs became the primary keys

`users.id` is the Firebase Auth UID; `children.id`, `posts.id` and `orders.id` are
the Firestore document IDs. Nothing is renumbered, every `DocumentReference`
resolves directly, and an export the school already holds still matches.

The cost is `text` primary keys instead of `uuid`. For a few thousand rows that
is irrelevant, and it buys a migration with no translation table — which is one
fewer thing that can be subtly wrong.

### Arrays of references became junction tables

`Children.parents` and `Posts.likes` were arrays of `DocumentReference`.
They are now `child_parents` and `post_likes`, with foreign keys.

This is what makes "which articles are for my children's classes" a single
indexed query instead of reading every post into the browser. It also stops the
old app's habit of accumulating references to deleted users. And it fixes a
privacy leak: the old feed shipped every post's full `likes` array to every
reader, so any parent could see exactly which other parents had liked what.

Arrays of *strings* stayed arrays (`posts.classroom`, `orders.consumption_dates`,
`users.teacher_classroom`). They are read whole and never joined on, so a table
would add work for nothing. `posts.classroom` has a GIN index.

### The denormalised order columns were kept on purpose

`orders` still carries `created_for_name`, `created_for_classroom`,
`created_by_email` and so on, even though it has foreign keys to `children` and
`users`. That is not redundancy, it is history: the invoice must show the class the
child was in when the order was placed, not the class they are in now after moving
up a year.

`resyncOpenOrderClassroomsAction` in `src/lib/actions/orders.ts` refreshes these
for orders still in `Besteld` only, so a child who changes class mid-year appears
on the right teacher's list, while delivered orders stay as they were.

### Passwords: Firebase scrypt, then upgrade in place

`src/lib/auth/password.ts` implements Firebase's modified scrypt (scrypt to derive
a key, then AES-256-CTR over the project signer key) so existing hashes verify
directly. On a correct login the account is rewritten to our own
`scrypt$N$r$p$salt$key` format and the Firebase material is cleared.

Node's built-in `crypto.scrypt` does both, so there is no native module to
compile and nothing that can fail to install on a host. The implementation is
checked against the published Firebase test vector in `test/password.test.ts`;
that test is a release blocker, not a nicety.

Why not bcrypt or Argon2: both mean a native dependency, and scrypt at N=2^16 is
a defensible choice for a school parent portal. If you later want Argon2, the
`verifyPassword` seam already supports a third format — add it and let
`rehashTo` upgrade accounts on login, exactly as the Firebase path does now.

### Sessions in the database, not JWTs

An opaque random id in an HttpOnly cookie, signed with `SESSION_SECRET`, with the
truth in the `sessions` table. One query per request, and blocking an account logs
it out everywhere immediately. A JWT would save the query and cost revocability,
which is the wrong trade when an admin laptop can go missing.

### Next.js instead of keeping Flutter

A browser cannot hold a Postgres credential, so moving to Neon required a server
either way. Given a server, rendering HTML on it rather than shipping a canvas
gets the school:

- **Search results.** Flutter web paints into a `<canvas>`; there is no text for a
  crawler. A school that parents find by searching for it was invisible.
- **A tenth of the payload.** No Dart runtime to download before the first word
  appears.
- **Accessibility.** Real headings, labels, focus order and landmarks, which a
  canvas cannot express.
- **Maintainability.** Any web developer can read this. The largest old page was
  6,859 lines of generated widget tree nested forty levels deep.

The cost is honest: the site is not pixel-identical to the old one, and the
FlutterFlow visual editor is gone. The colours (`#54363C`, `#7E812E`, `#709848`,
`#84A59E`), the Outfit and Readex Pro fonts, all 26 images, all 5 PDFs and the
Dutch copy are carried across from the export.

### Every page is server-rendered per request

The header shows whether you are logged in, which means it reads the session
cookie, which makes every page dynamic. For a school site's traffic that is the
right trade: no cache to reason about, and a parent never sees a stale "Aanmelden"
button after logging in. If traffic ever justifies it, split the header into a
separately streamed component and the public pages can go back to being cached.

### Hot meals: the open dates are authoritative server-side

`content.maaltijd_datums` is the list of dates the school has opened.
`placeOrderAction` rejects any date not in it, so a stale tab or an edited form
cannot book a closed day, and "Bestellingen afsluiten" genuinely closes ordering
rather than only hiding the button.

### Adding a child links to an existing record when one matches

Two parents adding the same child (same name, surname and class) now share one
`children` row instead of creating two. In the old data this produced duplicate
pupils with orders split across them; `migrate:firestore` reports the existing
duplicates rather than guessing which to merge.

---

## Things deliberately left as they were

- **URLs.** `/onzeSchool` and `/homePage` are not how anyone would spell them
  today, but they are what is in search results and Facebook posts. They stayed;
  kebab-case aliases redirect onto them.
- **Order type and status names.** Still the Dutch strings the old app stored
  (`Drankkaart`, `Besteld`, `Uitgedeeld`) so exports the school has kept still line
  up. Only the gym casing changed.
- **"Oudercontact".** The old admin screen said *"Deze functie is momenteel nog
  niet actief"* and the profile said there were no sessions open. Both still say
  so. It was never built, and inventing it now would be scope the school did not
  ask for.
- **The Google Calendar embed.** The school edits the calendar in Google Calendar;
  embedding it means nothing to keep in sync. There is also an unused
  `GetCalendar` Sheets API call in the old `api_calls.dart`, with an API key
  committed in the source — it is not carried over. **Rotate or delete that key**:
  it is in the published bundle.

---

## Known gaps

- **Email needs SMTP credentials.** With `MAIL_DRIVER=console` (the default),
  password-reset mails are logged, not sent. Set `MAIL_DRIVER=smtp` and the
  `SMTP_*` variables before going live, or *wachtwoord vergeten* silently does
  nothing useful.
- **Uploads need the `S3_*` variables.** Until they are set, the post editor and
  the menu upload accept a URL but not a file, and say so. Existing Firebase
  Storage URLs are unaffected.
- **Google and Apple sign-in are not implemented.** The old app had the packages
  wired up. Accounts that used them have no password and must use *wachtwoord
  vergeten* once; `migrate:auth` lists exactly who they are. Adding the providers
  back is a contained change to `src/lib/auth/` if the school wants it.
- **Teacher scoping is by classroom string.** A teacher of `L2A` does not see
  `L2B`. That matches the old `teacher_classroom` array, and an admin can assign
  both.
