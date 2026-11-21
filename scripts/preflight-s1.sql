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
-- case-insensitive on the users side.
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
SELECT lower(btrim(email))                 AS normalized_email,
       count(*)                            AS accounts,
       array_agg(id ORDER BY "createdAt")  AS user_ids,
       array_agg(email ORDER BY "createdAt") AS stored_emails,
       array_agg("createdAt" ORDER BY "createdAt") AS created_at
  FROM users
 GROUP BY lower(btrim(email))
HAVING count(*) > 1
 ORDER BY accounts DESC, normalized_email;

\echo '2) users: rows whose email is not normalized (will be rewritten)'
SELECT count(*) AS non_normalized_users
  FROM users
 WHERE email <> lower(btrim(email));

\echo '3) users matching ADMIN_EMAILS in any case'
SELECT lower(btrim(u.email)) AS normalized_email,
       u.id,
       u.email               AS stored_email,
       u."emailVerified",
       u."createdAt"
  FROM users u
 WHERE lower(btrim(u.email)) IN (:admin_emails)
 ORDER BY normalized_email, u."createdAt";

\echo '4) invitations: case/whitespace duplicates per organization (must be empty)'
SELECT lower(btrim(email))                 AS normalized_email,
       "organizationId",
       count(*)                            AS invitations,
       array_agg(id ORDER BY "createdAt")  AS invitation_ids,
       array_agg(email ORDER BY "createdAt") AS stored_emails
  FROM invitations
 GROUP BY lower(btrim(email)), "organizationId"
HAVING count(*) > 1
 ORDER BY invitations DESC, normalized_email;
