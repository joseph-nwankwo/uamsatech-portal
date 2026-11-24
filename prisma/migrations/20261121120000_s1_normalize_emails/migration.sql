-- S1: emails are stored edge-trimmed, lowercased and printable ASCII,
-- enforced by the database on users and invitations.
--
-- "Trimmed" means exactly what the app's normalizeEmail() strips: the 25
-- characters JS String.prototype.trim() removes (lib/auth/normalize-email.ts,
-- EMAIL_TRIM_CODE_POINTS). btrim() only strips spaces, so it is not used here.
-- tests/unit/normalize-email.test.ts checks the character class below against
-- the app's list.
--
-- "Printable ASCII" means every character is in 0x20-0x7E ('^[ -~]*$'). The
-- app only accepts ASCII emails (z.email()), and JS toLowerCase() and Postgres
-- lower() agree on ASCII (in any non-Turkish locale; preflight shows lc_ctype).
-- The rule also rejects inner control characters such as a tab.
--
-- Run scripts/preflight-s1.sql against the target database first. This
-- migration never merges, edits by hand or deletes rows: if any row would
-- collide once normalized, or isn't printable ASCII once normalized, a guard
-- aborts before the first write so a human can decide what to do.
--
-- Transactions: `prisma migrate deploy` sends this file as one batch, which
-- Postgres runs as a single transaction, so an abort rolls back everything,
-- including CREATE FUNCTION (Prisma still records the migration as failed:
-- fix the data, then `prisma migrate resolve --rolled-back <name>`). If you
-- ever apply it by hand, use
--   psql --single-transaction -v ON_ERROR_STOP=1 -f migration.sql
-- Without --single-transaction each statement commits on its own: the
-- function would survive an abort and the rerun would fail on CREATE FUNCTION.

-- The one SQL definition of the normal form (minus the ASCII rule, which is a
-- separate CHECK so a violation names the rule it broke). The regex literal is
-- an E'' string so it reads the same whatever standard_conforming_strings is
-- set to (a $$ function body is re-parsed with the caller's settings).
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
  'S1 email normal form: strips the characters JS trim() strips, then lower(). Must match normalizeEmail() in lib/auth/normalize-email.ts. CHECK users_email_normalized and CHECK invitations_email_normalized depend on this function: if it ever changes, drop or replace those constraints first, re-normalize existing rows, then re-add them.';

-- Guards. All four run before any write.

-- a) users rows that differ only by case / edge whitespace.
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

-- b) Same for invitations, which are unique on (email, organizationId).
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

-- c) users emails that aren't printable ASCII once normalized. Reports ids
--    only, not the addresses.
DO $$
DECLARE
  n int;
  ids text;
BEGIN
  SELECT count(*), string_agg(id, ', ' ORDER BY id)
    INTO n, ids
    FROM "users"
   WHERE "portal_normalize_email"(email) !~ '^[ -~]*$';
  IF n > 0 THEN
    RAISE EXCEPTION 'S1 migration aborted: % users row(s) have a non-printable-ASCII email after normalization (ids: %). Fix or remove them by hand (see scripts/preflight-s1.sql query 5), then re-run.', n, ids;
  END IF;
END $$;

-- d) Same for invitations.
DO $$
DECLARE
  n int;
  ids text;
BEGIN
  SELECT count(*), string_agg(id, ', ' ORDER BY id)
    INTO n, ids
    FROM "invitations"
   WHERE "portal_normalize_email"(email) !~ '^[ -~]*$';
  IF n > 0 THEN
    RAISE EXCEPTION 'S1 migration aborted: % invitations row(s) have a non-printable-ASCII email after normalization (ids: %). Fix or remove them by hand (see scripts/preflight-s1.sql query 5), then re-run.', n, ids;
  END IF;
END $$;

-- Normalize existing rows.
UPDATE "users" SET "email" = "portal_normalize_email"("email") WHERE "email" <> "portal_normalize_email"("email");
UPDATE "invitations" SET "email" = "portal_normalize_email"("email") WHERE "email" <> "portal_normalize_email"("email");

-- Enforce it. With the existing unique indexes (users_email_key,
-- invitations_email_organizationId_key) this makes uniqueness case- and
-- whitespace-insensitive. Prisma does not model CHECK constraints or
-- functions, so all of these are invisible to (and left alone by) migrate diff.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("email" = "portal_normalize_email"("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_email_ascii" CHECK ("email" ~ '^[ -~]*$');
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_normalized" CHECK ("email" = "portal_normalize_email"("email"));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_ascii" CHECK ("email" ~ '^[ -~]*$');
