-- The editable site text lives in exactly one row. Create it if the Firestore
-- import has not already supplied it, so the site renders on an empty database.
INSERT INTO "content" ("id") VALUES ('singleton')
ON CONFLICT ("id") DO NOTHING;
