-- S1: emails are stored trimmed + lowercased, enforced by the database.
--
-- Run scripts/preflight-s1.sql against the target database first. This
-- migration never merges or deletes rows: if two rows would collide once
-- normalized, it aborts (and the whole migration rolls back) so a human can
-- decide which account to keep.

-- a) Abort on users rows that differ only by case / surrounding whitespace.
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(format('%s (%s rows)', norm, n), ', ')
    INTO dupes
    FROM (
      SELECT lower(btrim(email)) AS norm, count(*) AS n
        FROM "users"
       GROUP BY lower(btrim(email))
      HAVING count(*) > 1
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'S1 migration aborted: users.email has case/whitespace duplicates: %. Resolve them by hand (see scripts/preflight-s1.sql), then re-run.', dupes;
  END IF;
END $$;

-- d) Same guard for invitations, which are unique on (email, organizationId).
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(format('%s in org %s (%s rows)', norm, org, n), ', ')
    INTO dupes
    FROM (
      SELECT lower(btrim(email)) AS norm, "organizationId" AS org, count(*) AS n
        FROM "invitations"
       GROUP BY lower(btrim(email)), "organizationId"
      HAVING count(*) > 1
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'S1 migration aborted: invitations has case/whitespace duplicates per organization: %. Resolve them by hand (see scripts/preflight-s1.sql), then re-run.', dupes;
  END IF;
END $$;

-- b) Normalize existing rows.
UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));
UPDATE "invitations" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));

-- c) Enforce it. With the existing unique index users_email_key this makes
--    email uniqueness case-insensitive. Prisma does not model CHECK
--    constraints, so it is invisible to (and left alone by) migrate diff.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("email" = lower(btrim("email")));
