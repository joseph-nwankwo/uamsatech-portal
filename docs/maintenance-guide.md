# Maintenance Guide

The recurring, non-emergency upkeep this project needs over time — as distinct from the Operations Guide's "something's actively wrong" scope.

## Database backups

`scripts/backup-db.sh` / `scripts/restore-db.sh` (Phase 14), also available as `npm run db:backup` / `npm run db:restore`. The backup script prunes anything older than `RETENTION_DAYS` (default 14) automatically — run it on a schedule (cron, a Kubernetes `CronJob`, or your platform's scheduled-job feature) rather than only manually. Store backups somewhere other than the same host as the database; a backup that lives on the machine that just failed doesn't help.

**Test the restore path periodically, not just the backup path.** A backup you've never restored from is a hope, not a plan. `scripts/restore-db.sh` requires typing `restore` to confirm before touching anything, and `--clean --if-exists` means it's safe to run against a fresh target database for a test restore.

## Prisma schema changes going forward

This project has used `prisma db push` throughout development (no tracked migration history). That's fine for a single-developer/pre-launch project, but **switch to `prisma migrate dev` (locally) / `prisma migrate deploy` (in CI/production) once this has real production data** — `db push` can't express "add this column, backfill it, then make it required" as a safe multi-step migration the way `prisma migrate` can, and it has no rollback history.

**Sandbox note, may or may not apply to your environment:** partway through this project's development, the `prisma` CLI's schema-engine binary started returning `Access Denied` when spawned (while the separate query engine and `prisma generate` continued working fine) — cause undetermined (not Windows Defender, not a Mark-of-the-Web block, ruled out both directly). Worked around by applying the schema change via a raw `ALTER TABLE` through the Prisma Client's `$executeRawUnsafe`, then running `prisma generate` (unaffected) to bring the TypeScript client's types in sync. If `prisma db push`/`migrate` ever mysteriously starts failing with a permissions error despite the database itself being reachable, this is a real, previously-encountered failure mode worth checking for — not necessarily a schema problem.

## Dependency updates — now mostly automated

**Dependabot** (`.github/dependabot.yml`) opens a PR weekly for outdated npm packages and GitHub Actions versions — routine patch/minor bumps are grouped into one PR to keep the queue reviewable; anything on `prisma`/`@prisma/client` is excluded from auto-proposal entirely (see the pin note below). Every Dependabot PR runs the **full CI suite** (`.github/workflows/ci.yml`) — typecheck, lint, build, unit tests, and the security-focused integration tests against a real running instance — before you'd ever merge it, so a patch that breaks something real gets caught by the same tests that catch a human's mistake, not waved through because "it's just a dependency bump."

A separate **`.github/workflows/security-scan.yml`** runs `npm audit` every Monday (plus on-demand via `workflow_dispatch`) independently of any code change — this is what actually notices a newly-disclosed CVE in a dependency nobody has touched in months; Dependabot then proposes the fix. The job fails loudly on any high/critical finding and always uploads a full audit report as a build artifact (90-day retention) even on a clean run, so there's a paper trail to check.

`prisma`/`@prisma/client` are **deliberately pinned to 6.19.3** — `npm install prisma@latest` lands on Prisma 7, which removes the classic `datasource { url = env(...) }` schema syntax in favor of driver adapters + `prisma.config.ts`, a real breaking migration, not a drop-in upgrade. Don't bump this without a deliberate migration project; Dependabot is configured to never propose it.

For anything Dependabot doesn't cover (a manual review of a major-version bump, an update outside its weekly cadence): `npm outdated`, update one package at a time rather than a blanket `npm update`, run the full verify sequence after each (`npm run typecheck && npm run lint && npm run test && npm run build`). This project's npm registry access has a documented history of being slow/flaky in some environments — if an install hangs or partially completes, verify with `node -e "require('<pkg>/package.json')"` rather than assuming it worked or killing it mid-install (an interrupted install has previously caused real `package.json`/`node_modules` desync in this project).

## The automated test suite

Two separate suites, two separate purposes:

- **`npm run test`** — unit tests (`tests/unit/**`, Vitest). Pure logic, no server or database needed: password hashing, token generation/hashing, the in-memory rate limiter's actual blocking behavior, the OWNER/ADMIN/MEMBER permission matrix, the anonymous-comment display-name fallback, and the dev-vs-production CSP split. Fast enough to run on every save locally (`npm run test:watch`).
- **`npm run test:security`** — security/integration tests (`tests/security/**`, separate Vitest config). Hit a **real running instance** over HTTP — same "verify the real thing, not a mock" approach this project's manual E2E passes have used every phase. Requires `TEST_BASE_URL` pointed at a running app (defaults to `http://localhost:3000`) and a real database with the standard seed data loaded (`node prisma/seed.js` — the tests comment on a real seeded blog post, not a fixture invented for tests). **Run this against a production build (`npm run build && node .next/standalone/server.js`), not `next dev`** — the dev server has a documented module-isolation quirk (`docs/14-production-hardening.md`) that makes in-memory rate-limit state unreliable across requests, which will make the rate-limit test flaky for reasons that have nothing to do with the actual code.

What the security suite actually asserts, so a regression here means something real broke: every protected route rejects an anonymous caller; `/admin` 404s a non-admin account (not 403 — the distinction matters, see `docs/13-analytics.md`); a user can't delete another user's blog comment; an XSS payload posted as a comment renders HTML-escaped, never as a live tag; `change-password` allows exactly its configured 5 attempts before returning `429`; every response carries the full security header set and never leaks `X-Powered-By`; malformed/oversized/SQL-injection-shaped input gets a clean `400`, not a `500` or a silent bypass.

**A real operational note from building this suite**: `tests/security/**` signs up real throwaway accounts against the real signup endpoint — and signup is rate-limited to 5/hour per IP (correctly; don't loosen it for test convenience). The suite shares one test user across files that only need a single identity via Vitest's `globalSetup`/`inject`, and only creates a second user where a test inherently needs two distinct identities (IDOR) — 3 signups per full run, not 7+. If you add a new security test, prefer `inject("sharedUser")` over a fresh `createTestUser()` call unless the test specifically needs its own identity.

## Certificate renewal

- Kubernetes + cert-manager: automatic, nothing to do — it renews before expiry and updates the `uamsatech-tls` secret in place.
- Docker/nginx + certbot: not automatic by default — add a cron job (`certbot renew --quiet` + an nginx reload) if you're on this path, since `deploy/nginx/uamsatech.conf` doesn't set this up for you.

## Log retention

This app never writes its own log files — everything goes to stdout/stderr as JSON. Retention is entirely the responsibility of whatever collects those streams (your platform's log service, a `docker logs` driver, a Kubernetes log aggregator). There's nothing in this repo to configure for rotation; configure it at that layer.

## Adding/removing an admin

Edit `ADMIN_EMAILS` (comma-separated) and redeploy — there's no UI for this by design (see `docs/13-analytics.md` and `docs/14-production-hardening.md` for why `/admin` uses this minimal gate instead of a full role system). Changes take effect on the next request after redeploy; no session invalidation needed since it's checked per-request, not baked into the JWT.

## Rotating provider credentials

Each of these is independent — rotating one doesn't require touching the others:

- `RESEND_API_KEY` — update the env var; no downtime, emails just start using the new key.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, and the Paystack/Flutterwave equivalents — update the provider's dashboard and the env var together (see the Operations Guide's webhook-signature-mismatch symptom if these drift out of sync).
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — update the env var; existing uploaded avatar URLs are unaffected since they're plain public URLs, not signed.
- `AUTH_JWT_SECRET` — see the Operations Guide; this one is disruptive (signs everyone out) by design, not a bug to work around.

## Routine review cadence (a starting point, adjust as this grows)

Now split between what's automated and what still needs a human:

- **Automated, no action needed unless something fails:** `security-scan.yml` (weekly `npm audit`), Dependabot (weekly dependency PRs, each gated by full CI including the security test suite).
- **Monthly (human, prompted automatically):** `security-review-reminder.yml` opens a GitHub issue on the 1st of every month with a fixed checklist (re-run `npm run test:security` against production, diff new routes for missing auth/rate-limits/org-scoping, re-check the `/admin` gate and `ADMIN_EMAILS`, check for the raw-Prisma-`include`-leak pattern, skim unmerged `npm audit` findings, confirm no secrets leaked into logs, spot-check security headers) — also confirm the last automated backup actually succeeded (file exists, recent timestamp, not just "the job ran"). This is the mechanism for the "periodic security review" this automation was built for; it only fires once the repo is pushed to GitHub with Actions enabled, same precondition as `security-scan.yml`. Close the issue once reviewed.
- **Weekly (human):** review and merge any Dependabot PRs that passed CI; glance at `/admin/revenue` and `/admin/customers` for anything obviously wrong (signups flatlined, MRR dropped unexpectedly).
- **Quarterly (human):** do a real test restore from a backup into a scratch database; review `ADMIN_EMAILS` for anyone who shouldn't still have access (also covered monthly by the issue above, worth a second unhurried look quarterly regardless).
