-- S1: emails are stored edge-trimmed + lowercased, enforced by the database.
--
-- "Trimmed" means exactly what the app's normalizeEmail() strips: the 25
-- characters JS String.prototype.trim() removes (lib/auth/normalize-email.ts,
-- EMAIL_TRIM_CODE_POINTS). btrim() only strips spaces, so it is not used here.
-- tests/unit/normalize-email.test.ts checks the character class below against
-- the app's list.
--
-- Run scripts/preflight-s1.sql against the target database first. This
-- migration never merges or deletes rows: if two rows would collide once
-- normalized, it aborts before writing anything so a human can decide which
-- account to keep.

-- The one SQL definition of the normal form. The regex literal is an E''
-- string so it reads the same whatever standard_conforming_strings is set to
-- (a $$ function body is re-parsed with the caller's settings).
CREATE FUNCTION "portal_normalize_email"(email text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(
    email,
    E'^[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$',
    '',
    'g'
  ))
$$;

COMMENT ON FUNCTION "portal_normalize_email"(text) IS
  'S1 email normal form: strips the characters JS trim() strips, then lower(). Must match normalizeEmail() in lib/auth/normalize-email.ts. CHECK users_email_normalized on users depends on this function: if it ever changes, drop or replace that constraint first, re-normalize existing rows, then re-add it.';

-- a) Abort on users rows that differ only by case / edge whitespace.
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(format('%s (%s rows)', norm, n), ', ')
    INTO dupes
    FROM (
      SELECT "portal_normalize_email"(email) AS norm, count(*) AS n
        FROM "users"
       GROUP BY 1
      HAVING count(*) > 1
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'S1 migration aborted: users.email has case/whitespace duplicates: %. Resolve them by hand (see scripts/preflight-s1.sql), then re-run.', dupes;
  END IF;
END $$;

-- b) Same guard for invitations, which are unique on (email, organizationId).
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(format('%s in org %s (%s rows)', norm, org, n), ', ')
    INTO dupes
    FROM (
      SELECT "portal_normalize_email"(email) AS norm, "organizationId" AS org, count(*) AS n
        FROM "invitations"
       GROUP BY 1, 2
      HAVING count(*) > 1
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'S1 migration aborted: invitations has case/whitespace duplicates per organization: %. Resolve them by hand (see scripts/preflight-s1.sql), then re-run.', dupes;
  END IF;
END $$;

-- c) Normalize existing rows.
UPDATE "users" SET "email" = "portal_normalize_email"("email") WHERE "email" <> "portal_normalize_email"("email");
UPDATE "invitations" SET "email" = "portal_normalize_email"("email") WHERE "email" <> "portal_normalize_email"("email");

-- d) Enforce it. With the existing unique index users_email_key this makes
--    email uniqueness case- and whitespace-insensitive. Prisma does not model
--    CHECK constraints or functions, so both are invisible to (and left alone
--    by) migrate diff.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("email" = "portal_normalize_email"("email"));
