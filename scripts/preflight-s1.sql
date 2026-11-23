-- scripts/preflight-s1.sql — READ-ONLY checks before applying migration
-- 20261121120000_s1_normalize_emails. Contains SELECT statements only.
--
-- Run it against the target database (production first, before deploying):
--
--   psql "$DATABASE_URL" \
--     -v admin_emails="'admin@example.com','ops@example.com'" \
--     -f scripts/preflight-s1.sql
--
-- :admin_emails is a comma-separated list of single-quoted addresses: the
-- current ADMIN_EMAILS value. Write them in lowercase; matching below is
-- case- and whitespace-insensitive on the users side.
--
-- "Normalized" means exactly what the migration's portal_normalize_email()
-- and the app's normalizeEmail() do: strip the 25 characters JS trim()
-- strips from both ends, then lower(). The function doesn't exist before the
-- migration, so the expression is inlined here. The E'' regex literal reads
-- the same whatever standard_conforming_strings is set to.
-- tests/unit/normalize-email.test.ts checks every character class in this
-- file against the app's list.
--
-- How to read the output:
--   1) Any row here means the migration WILL ABORT. Decide which account to
--      keep for each group (by hand) before migrating.
--   2) How many rows the migration will rewrite. Informational.
--   3) Every account that maps to an allowlisted address, in any case. More
--      than one row per address, a row whose email isn't exactly the
--      lowercase address, or an unverified row created by someone other than
--      the real admin, are signs S1 was exploited. Also shows whether the
--      real admin is verified (after the fix, unverified = no /admin access).
--   4) Same as 1) for invitations, per organization.

\echo '1) users: case/whitespace duplicate groups (must be empty)'
SELECT n.normalized_email,
       count(*)                                AS accounts,
       array_agg(n.id ORDER BY n."createdAt")  AS user_ids,
       array_agg(n.email ORDER BY n."createdAt") AS stored_emails,
       array_agg(n."createdAt" ORDER BY n."createdAt") AS created_at
  FROM (
    SELECT u.*,
           lower(regexp_replace(u.email, E'^[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$', '', 'g')) AS normalized_email
      FROM users u
  ) n
 GROUP BY n.normalized_email
HAVING count(*) > 1
 ORDER BY accounts DESC, n.normalized_email;

\echo '2) users: rows whose email is not normalized (will be rewritten)'
SELECT count(*) AS non_normalized_users
  FROM users
 WHERE email <> lower(regexp_replace(email, E'^[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$', '', 'g'));

\echo '3) users matching ADMIN_EMAILS in any case'
SELECT n.normalized_email,
       n.id,
       n.email               AS stored_email,
       n."emailVerified",
       n."createdAt"
  FROM (
    SELECT u.*,
           lower(regexp_replace(u.email, E'^[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$', '', 'g')) AS normalized_email
      FROM users u
  ) n
 WHERE n.normalized_email IN (:admin_emails)
 ORDER BY n.normalized_email, n."createdAt";

\echo '4) invitations: case/whitespace duplicates per organization (must be empty)'
SELECT n.normalized_email,
       n."organizationId",
       count(*)                                AS invitations,
       array_agg(n.id ORDER BY n."createdAt")  AS invitation_ids,
       array_agg(n.email ORDER BY n."createdAt") AS stored_emails
  FROM (
    SELECT i.*,
           lower(regexp_replace(i.email, E'^[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$', '', 'g')) AS normalized_email
      FROM invitations i
  ) n
 GROUP BY n.normalized_email, n."organizationId"
HAVING count(*) > 1
 ORDER BY invitations DESC, n.normalized_email;
