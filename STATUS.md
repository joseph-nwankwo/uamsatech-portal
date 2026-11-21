# UAMSATech Portal — Status Audit

**Audit date:** 2026-11-21
**Audited:** working tree of branch `fix-scholarsuite-product-page` (commit `20d52ec` plus 7 uncommitted modified files and 3 untracked files)
**Method:** I read the code, ran every check locally, inspected the local database, and probed the running production build. README files and code comments were not taken as evidence. No application code was changed during the audit.

### Checks I ran

| Check                        | Command                                                              | Result                                                                  |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unit tests                   | `vitest run --config vitest.config.ts`                               | ✅ **320 / 320 passed** (14 files, 29.9 s)                              |
| Security / integration tests | `vitest run --config vitest.security.config.ts` against `next start` | ✅ **24 / 24 passed** (7 files)                                         |
| Typecheck                    | `tsc --noEmit`                                                       | ✅ 0 errors                                                             |
| Lint                         | `eslint`                                                             | ✅ 0 errors, 0 warnings                                                 |
| Format                       | `prettier --check .` (CI runs this step)                             | ❌ **27 files fail**                                                    |
| Production build             | `next build`                                                         | ✅ succeeded (≈10 min on this machine)                                  |
| Prisma                       | `prisma validate`, `prisma migrate status`                           | ✅ valid; 2 migrations; DB up to date                                   |
| Schema drift                 | `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel` | ✅ no difference                                                        |
| Dependencies                 | `npm audit --omit=dev`                                               | ❌ **29 vulns: 2 critical, 19 high, 8 moderate**                        |
| Health                       | `GET /api/health`, `GET /api/health/ready`                           | ✅ ok / ready (DB ok)                                                   |
| Live probe of the admin gate | signed up a case-variant of an `ADMIN_EMAILS` address                | ❌ **got HTTP 200 on `/admin/revenue`** (probe user deleted afterwards) |

---

## 1. Overview

**What it is.** UAMSATech is the central web property for a suite of education products: a marketing website, a customer portal, billing, and an SSO hub. Users sign up, join organizations, and pay for products through Stripe, Paystack or Flutterwave. The products are LectureSuite, ScholarSuite, ResearchSuite, UAMSA and Records. The portal then launches users into each product with a signed, short-lived token, and product backends call back to check entitlement. It also hosts a blog, docs, a knowledge base, support tickets, a status page, and internal admin dashboards.

**Stack** (versions installed in `node_modules` / `package.json`)

| Area             | Choice                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js **15.5.20** (App Router, `output: "standalone"`), React **19.2.7**, TypeScript 5                                          |
| DB               | PostgreSQL (local is PG 18; CI uses PG 16) via Prisma **6.19.3**                                                                  |
| Auth             | Hand-rolled: `jose` 6 HS256 JWT access token (15 min) plus an opaque refresh token (30 d, stored hashed), `bcryptjs` 3 (cost 12)  |
| Validation       | Zod **4.4.3**                                                                                                                     |
| UI               | Tailwind 4, shadcn / Base UI, lucide-react, framer-motion 12, recharts 3                                                          |
| Payments         | `stripe` 22.3; Paystack and Flutterwave over raw `fetch`                                                                          |
| Infra libs       | `ioredis` 5 (optional), `@aws-sdk/client-s3` 3 (optional), Resend over `fetch` (optional)                                         |
| Tests            | Vitest 4.1                                                                                                                        |
| Tooling          | ESLint 9, Prettier 3, Husky + lint-staged                                                                                         |
| Deploy artifacts | `vercel.json`, `Dockerfile`, `docker-compose.yml`, `deploy/k8s/*`, `deploy/nginx`, Prometheus/Grafana configs, 4 GitHub workflows |

**Folder structure**

```
app/(marketing)/   public site: home, products, pricing, blog, support, status, legal …  (24 pages)
app/portal/        authenticated customer portal (15 pages)
app/admin/         internal dashboards gated by ADMIN_EMAILS (6 pages)
app/docs/          documentation site (content lives in features/docs/content/*.ts)
app/api/           46 route handlers: auth, billing, portal, internal, v1, health, metrics
features/          per-domain UI components and queries (auth, portal, blog, docs, support, admin …)
lib/               auth, billing (+ billing/domain), portal, env, db, redis, storage, logger
prisma/            schema.prisma (41 models), 2 migrations, seed.js
tests/unit/        14 files, pure/unit tests with mocked DB
tests/security/    7 files, HTTP tests against a running server
deploy/  docs/  scripts/  .github/
```

**Running locally**

1. Postgres running, `.env` filled in (see `.env.example`). The required variables are `DATABASE_URL`, `AUTH_JWT_SECRET`, and `CRAFT_LAUNCH_SECRET` (≥32 chars, different from `AUTH_JWT_SECRET`).
2. `npm install && npx prisma migrate deploy && npm run db:seed && npm run dev`

Does it run? **Yes.** The dev server and the production build both start with no errors, and health and readiness return OK against the local DB. Caveats:

- No payment, email (Resend), S3, Redis, GA or Clarity keys are configured locally. Everything that depends on them is either disabled or falls back to logging to the console.
- `README.md` is still the unmodified `create-next-app` boilerplate.
- `.env.example` is missing `RESEARCHSUITE_SSO_URL` and `PORTAL_SERVICE_SECRET`. The local `.env` still contains stale `LECTURECRAFT_APP_URL` / `SCHOLARCRAFT_APP_URL` keys that nothing reads.

---

## 2. Feature inventory

Legend: **Done** = works end to end as far as I could verify · **Partial** = works, but with a real gap or bug · **Stubbed** = scaffolding only, not functional · **Missing** = no code.
"Tests" means automated tests that exercise this feature. ✅ = they exist and pass.

### Frontend / content

| #   | Feature                                                   | Status  | Evidence                                                                         | Tests?                        | Notes                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Marketing site                                            | Done    | `app/(marketing)/*` (home, about, solutions, customers, careers, pricing, legal) | N                             | Honest copy, no fabricated testimonials. "Customers" and "Careers" are honest empty states.                                                                                                                                                                                                            |
| 2   | Product catalog & product pages                           | Partial | `lib/site-config.ts`, `app/(marketing)/products/[slug]`                          | ✅ `catalog-slug.test.ts` (3) | **Catalog and DB slugs have drifted.** Code uses `lecturesuite` / `scholarsuite`; `prisma/seed.js` still seeds `lecturercraft` / `scholarcraft`. The local DB still has a `studyflow` product (retired in `1e749b8`) and no `researchsuite`. Patched page by page with `catalogSlugFor` (uncommitted). |
| 3   | Blog (list, post, category/tag, RSS, OG images, comments) | Partial | `app/(marketing)/blog/*`, `app/api/blog/*`                                       | ✅ security xss/idor          | **No authoring UI.** Posts exist only via `seed.js` or direct DB writes. `Author` is never queried by app code.                                                                                                                                                                                        |
| 4   | Newsletter                                                | Partial | `app/api/newsletter/subscribe`, `app/newsletter/unsubscribe/[token]`             | N                             | Collects subscribers. Nothing ever sends a newsletter.                                                                                                                                                                                                                                                 |
| 5   | Documentation site                                        | Done    | `app/docs/*`, `features/docs/content/*.ts`                                       | N                             | Static content compiled into the bundle. `developer.ts:173` publicly states no real payment has been processed.                                                                                                                                                                                        |
| 6   | Knowledge base                                            | Partial | `app/(marketing)/support/kb/*`                                                   | N                             | Read-only. 7 articles from seed, no editor. One article publicly admits there's no self-serve cancel or downgrade.                                                                                                                                                                                     |
| 7   | Status page / incidents                                   | Partial | `app/(marketing)/status/page.tsx`, `features/support/queries.ts`                 | N                             | Reads real `Incident` rows, but no UI or API creates or resolves incidents.                                                                                                                                                                                                                            |
| 8   | Contact form                                              | Partial | `app/api/contact/route.ts`                                                       | ✅ security injection         | Stored only. No notification email; admin sees the latest 5 on `/admin/marketing`.                                                                                                                                                                                                                     |
| 9   | In-app notifications                                      | Stubbed | `app/portal/notifications/page.tsx`                                              | N                             | Hard-coded empty state. The `emailNotificationsEnabled` preference is saved but **never read** by anything.                                                                                                                                                                                            |

### Auth & accounts

| #   | Feature                          | Status      | Evidence                                                                       | Tests?                                                       | Notes                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------- | ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Signup / login / logout          | Partial     | `app/api/auth/{signup,login,logout}`                                           | ✅ security (auth-required, rate-limit), `passwords.test.ts` | Good on timing-safe login and hashed tokens. Emails are normalized (trim + lowercase) and the DB enforces it (S1 fix, pending deploy).                                                                                                                                                                               |
| 11  | Session refresh                  | Partial     | `app/api/auth/refresh/route.ts`                                                | ✅ `tokens.test.ts` (helpers only)                           | Rotation is implemented, but **nothing calls `/api/auth/refresh`**: `middleware.ts` redirects to `/login` once the 15-min access token expires. In practice every portal session ends after 15 min. Reuse of a revoked token is not treated as compromise.                                                           |
| 12  | Email verification               | Partial     | `app/verify-email/page.tsx`                                                    | N                                                            | Works. Enforced for `/admin` (S1 fix); **not** for SSO launch, billing, or invitations. Sending needs Resend (not configured).                                                                                                                                                                                       |
| 13  | Password reset                   | Done        | `app/api/auth/{forgot,reset}-password`                                         | ✅ security rate-limit                                       | Revokes all sessions on reset. Needs Resend in prod.                                                                                                                                                                                                                                                                 |
| 14  | Multi-org selection              | Done        | `app/api/auth/select-organization`, `app/select-organization`                  | N                                                            |                                                                                                                                                                                                                                                                                                                      |
| 15  | **Organization creation**        | **Missing** | —                                                                              | —                                                            | **There is no code path, in the app, the seed, or scripts, that creates an `Organization`.** A new customer can never own an org. The 4 orgs in the local DB were created by hand. Everything institutional (team, invites, org billing, institutional entitlement) is therefore unreachable for self-service users. |
| 16  | Invitations                      | Done        | `app/api/portal/invitations/*`, `app/invite/[token]`                           | ✅ security idor                                             | Requires an existing org (see #15). The email is sent via Resend.                                                                                                                                                                                                                                                    |
| 17  | Roles & member management        | Done        | `lib/portal/permissions.ts`, `app/api/portal/members/[membershipId]`           | ✅ `permissions.test.ts` (4)                                 | Last-owner protection is in place. The role is read from the JWT, so it can be up to 15 min stale.                                                                                                                                                                                                                   |
| 18  | Active sessions (list / revoke)  | Done        | `app/portal/security`, `app/api/portal/sessions/*`                             | ✅ security idor                                             |                                                                                                                                                                                                                                                                                                                      |
| 19  | Profile, change password, avatar | Partial     | `app/api/portal/{profile,change-password,profile/avatar}`                      | N                                                            | Avatar upload needs S3 (unset), so it's disabled. Type and size are validated.                                                                                                                                                                                                                                       |
| 20  | API keys + `/api/v1/usage`       | Partial     | `app/api/portal/api-keys/*`, `lib/billing/api-key-auth.ts`, `app/api/v1/usage` | N                                                            | Any MEMBER can mint an org-scoped key. Keys **keep working after the user is removed from the org** (membership is never re-checked).                                                                                                                                                                                |
| 21  | Feature flags                    | Partial     | `app/api/admin/feature-flags/[id]`, `app/admin/feature-flags`                  | ✅ `security/feature-flags.test.ts`, `admin-feature-flags`   | S2 fixed, pending deploy: management moved behind the admin gate (404 to everyone else, org OWNERs included); each change is audited with old/new value. Customer reads (`isFeatureEnabled`) unchanged. No create/delete UI; flags come from the seed.                                                               |
| 22  | Admin dashboards                 | Partial     | `app/admin/*`, `lib/admin/auth.ts`                                             | ✅ `security/admin-gate.test.ts`                             | Dashboards use real data. The S1 bypass is fixed, pending deploy: the gate now needs a verified, allowlisted DB user and runs in every page. Regression tests are in `security/email-normalization.test.ts`.                                                                                                         |

### Billing & entitlement

| #   | Feature                                        | Status        | Evidence                                                                                | Tests?                                               | Notes                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | Stripe checkout + webhook                      | Partial       | `app/api/billing/stripe/*`, `lib/billing/stripe-sync.ts`                                | ✅ `billing-stripe.test.ts` (22)                     | Well designed: signature check, re-fetches from the API, idempotent. **Never run against Stripe**; no keys anywhere.                                                                                                                                                                                                                                        |
| 24  | Paystack checkout + webhook                    | Partial       | `app/api/billing/paystack/*`, `lib/billing/one-time-payment.ts`                         | ✅ `billing-webhooks.test.ts` (38)                   | HMAC-SHA512 signature, amount and currency verification, `FOR UPDATE` lock, idempotency. Never run live. `PAYSTACK_WEBHOOK_SECRET` env var is dead (unused).                                                                                                                                                                                                |
| 25  | Flutterwave checkout + webhook                 | Partial       | `app/api/billing/flutterwave/*`                                                         | ✅ (in webhook tests)                                | Re-verifies via API. Never run live.                                                                                                                                                                                                                                                                                                                        |
| 26  | Individual checkout                            | Partial (bug) | `lib/billing/checkout-context.ts:55`                                                    | N                                                    | Compares the **DB** slug (`lecturercraft`) with the **catalog** slug (`lecturesuite`) without `catalogSlugFor`. On any DB seeded by `seed.js`, individual LectureSuite and ScholarSuite checkout is refused with "only available to organizations". Meanwhile the (uncommitted) billing page _does_ show those plans.                                       |
| 27  | Coupons                                        | Partial       | `lib/billing/coupons.ts`                                                                | ✅ (in billing tests)                                | Applied at checkout, but no way to create a coupon (0 in DB).                                                                                                                                                                                                                                                                                               |
| 28  | Cancel / downgrade / refund / dispute handling | **Missing**   | Webhooks explicitly ignore non-success events                                           | —                                                    | **A refunded or charged-back payment never revokes access.** No self-serve cancel or plan change.                                                                                                                                                                                                                                                           |
| 29  | Invoices / receipts / PDF                      | Partial       | `Invoice` model, `app/portal/billing`                                                   | N                                                    | History list only. Stripe hosted-invoice URL is stored. **No PDF or receipt generation** for any provider, and no receipt emails.                                                                                                                                                                                                                           |
| 30  | Central billing ledger (AS-P0-007)             | Stubbed       | 10 tables in migration `…090100`; `lib/billing/domain/*`                                | ✅ `billing-domain.test.ts` (58)                     | Pure algorithms are well tested, but **every table has zero reads or writes in app code**, and the module header says "NOT WIRED".                                                                                                                                                                                                                          |
| 31  | SSO product launch                             | Partial       | `app/api/portal/launch/[product]`, `lib/auth/launch-jwt.ts`, `app/api/portal/sso-token` | ✅ `launch.test.ts` (37), `launch-links.test.ts` (6) | Entitlement is checked before a token is minted, plus audit logging, no-store, and an allowlisted destination. Issues: finding **S5** (state not bound to the portal user). The token carries an **unverified** email. Secure mode needs both `PORTAL_SERVICE_SECRET` and Redis (neither is set locally). Without them the JWT travels in the redirect URL. |
| 32  | Internal entitlement verify API                | Partial       | `app/api/internal/entitlements/verify`, `lib/portal/entitlement-service.ts`             | ✅ `internal-entitlements.test.ts` (18)              | Timing-safe, per-product credentials. **ResearchSuite is not supported** (`SERVICE_PRODUCTS` has only 2 products), even though it's launchable.                                                                                                                                                                                                             |

### Support & ops

| #   | Feature                                          | Status  | Evidence                                                    | Tests?                 | Notes                                                                                                                                                                                                            |
| --- | ------------------------------------------------ | ------- | ----------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | Support tickets                                  | Partial | `app/api/portal/support/tickets/*`, `app/portal/support`    | ✅ security idor       | Customers can open tickets and post to them. **Staff can only reply via direct DB writes** (schema comment says so). No admin view, no alert email.                                                              |
| 34  | Bug reports & feature requests                   | Partial | `app/api/support/bug-reports`, `app/api/feature-requests/*` | ✅ security            | Stored. Voting works. No triage UI; bug reports are never shown to anyone.                                                                                                                                       |
| 35  | Email delivery                                   | Partial | `lib/auth/email.ts`                                         | N                      | Resend over `fetch`. Unset locally, so emails are logged to the console. No templates, no retry, no bounce handling.                                                                                             |
| 36  | First-party analytics + GA / Clarity             | Done    | `lib/analytics/track.ts`, `components/analytics/*`          | N                      | 57 events recorded locally. GA and Clarity load only when their IDs are set.                                                                                                                                     |
| 37  | Observability (health, metrics, logger, Grafana) | Partial | `app/api/health*`, `app/api/metrics`, `deploy/grafana`      | N                      | **`/api/metrics` is public when `METRICS_TOKEN` is unset** (returned 200 in my probe). On Vercel there is no nginx IP filter.                                                                                    |
| 38  | Rate limiting                                    | Partial | `lib/auth/rate-limit.ts`                                    | ✅ unit (5) + security | In-memory per instance unless Redis is set; that's weak on serverless. **Client IP comes from the first `X-Forwarded-For` entry, which is spoofable**: I bypassed the 5/hour signup limit with a made-up header. |
| 39  | Security headers / CSP                           | Done    | `lib/security-headers.ts`, `next.config.ts`                 | ✅ unit (7) + security | HSTS, frame-ancestors none, nosniff. CSP allows `'unsafe-inline'` scripts.                                                                                                                                       |

### Database, tests, deployment

| #   | Feature                      | Status           | Evidence                                                 | Tests?                      | Notes                                                                                                                                                                                                                                                                       |
| --- | ---------------------------- | ---------------- | -------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40  | Schema & migrations          | Done             | `prisma/schema.prisma`, `prisma/migrations/*`            | ✅ validate / status / diff | 41 models, 42 tables (the extra is the `_BlogPostTags` join table). No drift against the local DB.                                                                                                                                                                          |
| 41  | Seed data                    | Partial          | `prisma/seed.js`                                         | —                           | Seeds the stale product slugs and names (LecturerCraft / ScholarCraft).                                                                                                                                                                                                     |
| 42  | Unit tests                   | Partial          | `tests/unit/*`                                           | ✅ 320 / 320                | 74% of test cases (168 / 227) cover billing and launch. Nothing covers signup/login routes, invitations, members, orgs, support, blog, admin, or any UI component.                                                                                                          |
| 43  | Security / integration tests | Done             | `tests/security/*`                                       | ✅ 24 / 24                  | Not run by CI (see #44). Leaks test users (14 `@example.com` accounts left in the local DB).                                                                                                                                                                                |
| 44  | CI pipeline                  | Stubbed (broken) | `.github/workflows/ci.yml`                               | —                           | **Never runs**: it triggers on `main`, but the repo's default branch is `master`. If it did run, it would fail: no `CRAFT_LAUNCH_SECRET` in the CI env (the env schema throws), and the Prettier check fails on 27 files. It also uses `db push` instead of the migrations. |
| 45  | Vercel deployment            | Partial          | `vercel.json`, README "Live at uamsatech.com"            | —                           | Not verifiable from here. No migration step in the build (it was reverted in `ced82e4`), so migrations must be applied by hand.                                                                                                                                             |
| 46  | Docker / K8s / nginx         | Partial          | `Dockerfile`, `deploy/*`, `.github/workflows/deploy.yml` | —                           | Templates only. The deploy workflow stops at "push image" and also triggers on `main`. Not built during this audit.                                                                                                                                                         |

---

## 3. Database

**Migrations** (`prisma/migrations`, PostgreSQL, applied locally, no drift):

1. `20261105090000_portal_baseline`: 32 tables, a baseline of the schema that was previously managed with `db push`. Its header says existing environments must mark it applied via `migrate resolve --applied` after a dump comparison. **That's a manual production step, and I can't confirm it was done.**
2. `20261105090100_as_p0_007_central_billing_foundation`: 10 tables for the central billing ledger.

**Tables (41 models).**

- **Core / auth:** `users`, `organizations`, `memberships`, `invitations`, `refresh_tokens`, `verification_tokens`, `api_keys`, `audit_logs`
- **Billing:** `products`, `plans`, `product_plans`, `subscriptions`, `invoices`, `coupons`, `usage_records`, `feature_flags`
- **Content:** `blog_posts`, `authors`, `categories`, `tags`, `comments`, `_BlogPostTags`, `knowledge_base_articles`, `newsletter_subscribers`, `contact_messages`
- **Support:** `support_tickets`, `ticket_messages`, `bug_reports`, `feature_requests`, `feature_request_votes`, `incidents`
- **Analytics:** `analytics_events`
- **Central billing (AS-P0-007):** `provider_events`, `entitlement_periods`, `payment_refunds`, `payment_disputes`, `organization_institution_links`, `institution_licences`, `licence_seats`, `trial_grants`, `operator_grants`, `entitlement_changes`

**Defined but unused**

- **All 10 central-billing tables** have zero reads or writes in app code (0 rows locally).
- `Author` is written by the seed but never queried by the app.
- `Plan` is used only by the seed plus one read.
- Write-only from the app's perspective (no admin UI ever reads them back): `bug_reports` and `ticket_messages` (staff side). Contact messages get only a "latest 5" view.
- Content tables with **no app write path**: `blog_posts`, `knowledge_base_articles`, `incidents`, `coupons`, `products`, `product_plans`. These are populated by seed or scripts only.

**Used but missing**

- No table is referenced in code without being defined.
- **Data** is missing or stale: `researchsuite` isn't in the local DB, the retired `studyflow` product is, and product slugs and names predate the rename. 4 of the 5 local subscriptions are ACTIVE with `provider = null` (granted by hand or by script).
- ~~**Missing constraint:** case-insensitive uniqueness on `users.email`.~~ Added by migration `20261121120000_s1_normalize_emails` (`CHECK users_email_normalized` plus the existing unique index). Applied locally; pending in production (see the S1 deploy checklist).

---

## 4. Quality & risk

### Test, lint and build results

- **Unit:** 320 passed / 0 failed (14 files).
- **Security / integration:** 24 passed / 0 failed (7 files), against `next start` locally.
- **Typecheck:** 0 errors. **Lint:** 0 problems. **Build:** passes.
- **Format:** ❌ 27 files fail `prettier --check`. That would fail CI.
- Passing tests do **not** catch S3 below. S1 and S2 now have regression tests (`security/email-normalization.test.ts`, `security/feature-flags.test.ts`).

### Security concerns, most severe first

| ID      | Severity                                                                                                                    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Where                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **S1**  | **Critical (confirmed live) → FIXED, pending deploy** (branch `fix/s1-s2-admin-gate`; see "S1 fix: deploy checklist" below) | **Admin takeover via email case.** Signup stores the email exactly as typed; `users.email` is case-sensitively unique; `isAdminEmail()` lowercases before comparing; nothing requires `emailVerified`. Signing up `ADMIN@EXAMPLE.COM` when `admin@example.com` is allowlisted gives full `/admin` access (revenue, customers). The same trick lets anyone take an allowlisted address that hasn't registered yet. It can also be used to deny someone product access: the entitlement API returns `ambiguous_account` once two case variants exist. | `app/api/auth/signup/route.ts`, `lib/admin/auth.ts:15`, `lib/portal/entitlement-service.ts:96` |
| **S2**  | **High → FIXED, pending deploy** (branch `fix/s1-s2-admin-gate`; see "S2 fix" below)                                        | **Any org OWNER can toggle global platform feature flags**, including the switches that turn payment providers on or off for every customer.                                                                                                                                                                                                                                                                                                                                                                                                        | was `app/api/portal/feature-flags/[id]/route.ts:19-48` (deleted)                               |
| **S3**  | High                                                                                                                        | **Spoofable client IP.** `requestIp()` trusts the first `X-Forwarded-For` value, and nginx uses `$proxy_add_x_forwarded_for`, which appends. Every IP-based rate limit (signup, forgot-password, webhook and internal-API throttles) can be bypassed. Confirmed against `next start`.                                                                                                                                                                                                                                                               | `lib/auth/rate-limit.ts:129-131`, `deploy/nginx/uamsatech.conf:83,94`                          |
| **S4**  | High                                                                                                                        | **`next@15.5.20` has a critical advisory** (App Router Server Actions DoS); a fix is available in range. Also `zod` (high, memory exhaustion) and 2 other high-severity direct dependencies.                                                                                                                                                                                                                                                                                                                                                        | `package.json`                                                                                 |
| **S5**  | Medium–High (plausible; depends on product side)                                                                            | **SSO `state` is supplied by the browser and isn't bound to the portal user.** An attacker can start `/sso/initiate` on a product (getting a state plus their own state cookie), then send a victim a link to `/api/portal/launch/<p>?state=<attacker's>`. The victim's token is stored under the attacker's state. If the product callback lets the attacker's browser redeem it, the attacker is logged into the victim's product account. The launch is a GET with no confirmation step.                                                         | `app/api/portal/launch/[product]/route.ts:139-172`                                             |
| **S6**  | Medium                                                                                                                      | Launch tokens carry an **unverified** email. Product backends provision and link accounts by email, so registering someone else's address on the portal first could claim their product account.                                                                                                                                                                                                                                                                                                                                                    | `lib/auth/launch-jwt.ts`, signup flow                                                          |
| **S7**  | Medium                                                                                                                      | `/api/metrics` is public when `METRICS_TOKEN` is unset (it exposes user and org counts). The production setting can't be verified.                                                                                                                                                                                                                                                                                                                                                                                                                  | `app/api/metrics/route.ts:13`                                                                  |
| **S8**  | Medium                                                                                                                      | Refunds, chargebacks and disputes never revoke access. Webhooks acknowledge and ignore them.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | all 3 webhook routes                                                                           |
| **S9**  | Medium                                                                                                                      | If `PORTAL_SERVICE_SECRET` is unset in prod, launch JWTs travel in redirect URLs (browser history and logs). If it _is_ set but Redis isn't, every launch returns 503. Neither is enforced for production.                                                                                                                                                                                                                                                                                                                                          | `lib/env.ts`, launch route                                                                     |
| **S10** | Low                                                                                                                         | API keys outlive org membership. `sso-token` compares the service secret with `!==` (not timing-safe). The CORS and post-login redirect allowlists accept any `http://localhost` origin even in production. CSP allows `'unsafe-inline'` scripts. The role in the JWT can be 15 min stale.                                                                                                                                                                                                                                                          | various                                                                                        |

### S1 fix: deploy checklist (fixed pending deploy, 2026-11-21)

What changed on `fix/s1-s2-admin-gate`:

- One helper, `normalizeEmail()` (trim + lowercase) and the Zod field `emailField()` in `lib/auth/normalize-email.ts`, used at every email write, lookup and comparison: signup, login, forgot-password, invitations (create, accept-match, invite page), the entitlement lookup, `/api/internal/entitlements/verify`, the launch JWT `email` claim, contact, bug reports, and the signup/login/forgot-password/contact forms. No ad-hoc `.toLowerCase()` on emails remains.
- Signup maps a P2002 race on `users_email_key` to the same 409 as a normal duplicate.
- `/admin` gate (`lib/admin/auth.ts`): the user is loaded from the DB by session id; admin only if `emailVerified` is set **and** the normalized email is in the normalized `ADMIN_EMAILS`. Empty or missing `ADMIN_EMAILS` means no admins. Checked in the layout **and** every `/admin` page. `requireAdminApi()` is used by admin API routes (first one: the S2 feature-flag route).
- Entitlement lookup is an exact lookup on the normalized email, so `ambiguous_account` can no longer happen because of email case. The response shape is unchanged.
- Migration `20261121120000_s1_normalize_emails`: aborts on case/whitespace duplicates in `users` and in `invitations` (per org), normalizes existing rows, adds `CHECK users_email_normalized`. Prisma doesn't model CHECK constraints; `migrate diff` (both `--from-migrations` and `--from-url`) shows no drift.

**Production steps, in this order. Production migrations are applied by hand.**

1. **Run `scripts/preflight-s1.sql` on production first** (read-only, see its header for the `psql` command and the `:admin_emails` variable). Query 1 and query 4 must return no rows, or the migration aborts. Query 3 shows which accounts hold each allowlisted address.
2. **Check that the real admin accounts are verified** (query 3, `emailVerified`). After this deploy an unverified admin gets a 404 on `/admin`. Locally the only real allowlisted account is unverified. Verify it through the normal email link (needs Resend), or set `emailVerified` by hand after confirming who owns the account.
3. If query 3 shows an account the real admin doesn't own (S1 exploited), deal with it before deploying: review its activity, then delete or rename it by hand.
4. Apply the migration: `npx prisma migrate deploy`.
5. Deploy the code. **Don't deploy the code before the migration**: users whose stored email has capitals couldn't log in until their row is normalized.
6. Never add `security-admin@example.com` (test-only, used by `tests/security/email-normalization.test.ts`) to the production `ADMIN_EMAILS`.

Follow-ups (not done in the S1 change):

- **Newsletter normalization:** `app/api/newsletter/subscribe` still stores the email as typed, and `newsletter_subscribers.email` is case-sensitively unique. It needs `emailField()` plus the same guard/normalize migration.
- **`scripts/grant-test-subscription.mjs`** still looks up users case-insensitively; switch it to `normalizeEmail` with an exact lookup.
- **S6** is still open: launch tokens can carry an unverified email.
- CI still uses `prisma db push`, so the CI database doesn't get the CHECK constraint (see roadmap #7).
- The security suite uses the full 5/hour signup budget; revisit with S3.

### S2 fix (fixed pending deploy, 2026-11-21)

What changed on `fix/s1-s2-admin-gate`:

- `PATCH /api/portal/feature-flags/[id]` and `/portal/feature-flags` are **deleted** (both now 404). The portal nav entry and the org-role `featureFlags.manage` permission are gone.
- Management lives at `/admin/feature-flags` (page, `getAdminContext()`) and `PATCH /api/admin/feature-flags/[id]` (`requireAdminApi()`, the first admin API route). Non-admins, including org OWNERs, get 404. Rate limit 30/hour per admin.
- Each change writes a `feature_flag.updated` `audit_logs` row (actor `userId`, `organizationId` null, `metadata: { key, oldValue, newValue }`) in the same transaction as the update. A no-op toggle writes nothing; an unknown id is 404 (was 500).
- Customer reads are unchanged: `isFeatureEnabled()` in `lib/billing/feature-flags.ts` (billing page provider switches).
- No schema change, no migration. Deploy is code-only, after the S1 migration.
- Grep check: the only runtime write to `feature_flags` is the admin route (`prisma/seed.js` upserts at seed time); no raw SQL references the table.

Follow-ups (not done in the S2 change):

- There's no admin view of the audit log yet; flag-change rows are effectively only visible in the DB (they show in `/portal/activity` only when the admin views their personal activity, since the org-wide view filters on `organizationId` and these rows have none).
- No admin create/delete for flags (by decision); new flags still come from `prisma/seed.js`.

- **SQL injection:** low risk. All DB access is through Prisma; the single raw query uses a tagged template (`one-time-payment.ts:167`, parameterized).
- **Secrets in code:** none found in tracked files. `.env`, `backups/` and `*.log` are git-ignored. `deploy/k8s/secret.yaml` holds placeholders only. A **real DB dump with user emails and password hashes** sits in `backups/` on disk (ignored, but it's there).

### Known bugs

1. Every portal session effectively ends after 15 minutes: refresh is never called (`middleware.ts`).
2. Individual checkout is refused for LectureSuite and ScholarSuite on seeded DBs (`lib/billing/checkout-context.ts:55`).
3. Users can't create organizations (no code path).
4. Catalog/DB slug drift (`prisma/seed.js:200-201` vs `lib/site-config.ts`), currently handled by per-page patches.
5. ResearchSuite is missing from the entitlement verify API (`lib/portal/entitlement-service.ts:16`).
6. The security test suite leaks users into whichever DB it runs against.

### TODO / FIXME

**None:** a full grep of `app`, `lib`, `features` and `components` finds no `TODO`, `FIXME`, `HACK` or `XXX` markers. Known gaps are written up in prose in `docs/*.md` and in code comments, for example `lib/billing/domain/period-ledger.ts:7` ("NOT WIRED") and `prisma/schema.prisma:457-461` (staff replies by script).

### Technical debt to fix before launch

- **CI is decorative.** Wrong branch, missing env, failing format check, and it uses `db push` rather than the migrations. Nothing currently guards `master`.
- **Two deploy paths** (Vercel and Docker/K8s) with no migration step in either.
- **Uncommitted work-in-progress** on a feature branch that touches SSO launch, billing and entitlement.
- **README** is boilerplate. `.env.example` is out of date.
- **No operational tooling for staff:** blog, KB, incidents, coupons, products/plans, and ticket replies all require direct DB access.
- **Two parallel billing models:** the live `subscriptions.currentPeriodEnd` and the unwired central ledger. Decide on one path before you get real payment volume.
- **Dependency housekeeping:** Prisma 6 `package.json#prisma` config is deprecated. `shadcn` (a CLI) is a runtime dependency.

---

## 5. Completion estimate

**Method.** Each of the 46 rows in §2 is scored Done = 1.0, Partial = 0.5, Stubbed = 0.15, Missing = 0. Every row has equal weight.

|           | Count                                          | Points                 |
| --------- | ---------------------------------------------- | ---------------------- |
| Done      | 11 (#1, 5, 13, 14, 16, 17, 18, 36, 39, 40, 43) | 11.0                   |
| Partial   | 30                                             | 15.0                   |
| Stubbed   | 3 (#9, 30, 44)                                 | 0.45                   |
| Missing   | 2 (#15, 28)                                    | 0                      |
| **Total** | **46**                                         | **26.45 / 46 = 57.5%** |

**Overall: about 58% complete** toward a production launch with paying users.

| Area                                             | Rows                    | Score                                                     | Comment                                                                                                           |
| ------------------------------------------------ | ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Backend (auth, orgs, billing, SSO, support APIs) | 10–35, 37, 38 (28 rows) | 15.15 / 28 = **54%**                                      | The code that exists is of high quality; what pulls the score down is missing flows and the security holes above. |
| Frontend (public site + portal UI)               | 1–9 (9 rows)            | 5.15 / 9 = **57%**                                        | Portal pages exist for every feature. The gaps are content tooling and notifications.                             |
| Database                                         | 30, 40, 41 (3 rows)     | 1.65 / 3 = **55%**                                        | Schema and migrations are solid. A quarter of the tables are unwired, and seed data is stale.                     |
| Tests                                            | 42, 43 (2 rows)         | 1.5 / 2 = 75% by the formula; **I'd put it at about 45%** | Everything passes, but coverage is lopsided and nothing runs in CI.                                               |
| Deployment                                       | 39, 44–46 (4 rows)      | 2.15 / 4 = **54%**                                        | A live site reportedly exists. CI and deploy automation don't actually work.                                      |

**Confidence: medium.** These parts are verified by execution: tests, typecheck, lint, build, migrations, health, metrics, and the admin bypass. The rest rests on reading the code.

**Could not verify:**

- The live production deployment (uamsatech.com): its env vars, whether the baseline migration was marked applied, `METRICS_TOKEN`, Redis, and `PORTAL_SERVICE_SECRET`.
- Any real payment-provider round trip.
- Resend email delivery and S3 uploads.
- The product-side SSO callbacks (LectureSuite, ScholarSuite, ResearchSuite live in other repos), which determine how exploitable S5 and S6 are.
- The Docker image build.
- UI behaviour in a browser. No pages were clicked through; pages were checked only via the build and code.

---

## 6. Roadmap to production

Sizes: **S** ≤ 1 day · **M** 2–5 days · **L** > 1 week.

### Blockers: must fix before any real user

1. ~~**Fix S1.**~~ **Fixed, pending deploy** on `fix/s1-s2-admin-gate`. Run `scripts/preflight-s1.sql` on production before deploying (see the S1 deploy checklist in §4). **S**
2. ~~**Fix S2.**~~ **Fixed, pending deploy** on `fix/s1-s2-admin-gate`. Flag management is admin-only at `/admin/feature-flags`; no migration (see "S2 fix" in §4). **S**
3. **Fix S3.** Derive the client IP from a trusted source: the platform header on Vercel, or the right-most trusted hop behind nginx. Use Redis-backed rate limiting in production. **S**
4. **Upgrade `next`** (critical advisory) **and `zod`**, then re-run `npm audit`. **S**
5. **Make sessions survive past 15 minutes.** Refresh in middleware or via a client interceptor. **M**
6. **Harden SSO (S5, S6, S9).** Bind `state` to the portal session (or require a POST confirmation step). Refuse launch for unverified emails. In production, fail boot if `PORTAL_SERVICE_SECRET` or `REDIS_URL` is unset. Coordinate the callback order with the product teams. **M**
7. **Fix CI.** Trigger on `master`, add `CRAFT_LAUNCH_SECRET` and the other required env vars, run Prettier, and use `prisma migrate deploy`. Add branch protection. **S**
8. **Require `METRICS_TOKEN` in production** (fail closed). **S**
9. **Fix individual checkout.** Use `catalogSlugFor` in `checkout-context.ts`, then commit the WIP branch. **S**

### Required for launch

10. **Self-serve organization creation**, plus a role bootstrap (creator becomes OWNER). **M**
11. **Data migration to canonical product slugs and names.** Add `researchsuite`, retire `studyflow`, update `seed.js`, then remove the `catalogSlugFor` shims. **S**
12. **End-to-end payment testing** in Stripe, Paystack and Flutterwave test modes, with real webhooks into a staging deploy. **M**
13. **Refund, dispute and chargeback handling** that revokes or suspends access (S8). **L**
14. **Self-serve cancel and plan change**, at minimum the Stripe customer portal. **M**
15. **Staff tooling.** Ticket replies, a bug-report and contact inbox, incident management, coupon and plan management. Plus email alerts to staff for new tickets and contact messages. **L**
16. **Configure Resend in production.** Proper templates, and honor `emailNotificationsEnabled`. **M**
17. **Add ResearchSuite to the entitlement verify API** (secret and env schema). **S**
18. **Pick one deploy path** and add `prisma migrate deploy` to the release process. Document and verify the baseline `migrate resolve` step in production. **S**
19. **Re-check org membership in API key auth**; revoke a user's org keys when they're removed. **S**
20. **Tests** for signup, login, refresh, invitations, member management and org flows, plus a regression test for S1 and S2. Fix user leaks in the security tests. **M**
21. **Rewrite README; fix `.env.example`.** Delete the local `backups/*.dump` or move it to encrypted storage. **S**

### Post-launch

22. **Wire the central billing ledger** (the 10 tables plus `lib/billing/domain`), or drop it. **L**
23. **In-app notifications.** **M**
24. **Invoice PDFs and receipt emails** for Paystack and Flutterwave. **M**
25. **Blog, KB and newsletter authoring UI** (or adopt a headless CMS). **L**
26. **CSP with nonces** (drop `'unsafe-inline'`). Restrict `localhost` origins to development. **M**
27. **Housekeeping.** Move to a Prisma config file (deprecation notice). Move `shadcn` to devDependencies. Remove the dead `PAYSTACK_WEBHOOK_SECRET` and stale `.env` keys. Treat refresh-token reuse as compromise. **S**
