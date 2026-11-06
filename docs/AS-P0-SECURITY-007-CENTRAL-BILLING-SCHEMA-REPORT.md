# AS-P0-SECURITY-007 — Central Billing Schema and Entitlement Foundation

**Date:** 4 November 2026
**Repositories:** UAMSA Tech portal (`uamsatech/`), LectureSuite (`LectureCraft/`), ScholarSuite (`ScholarCraft/`). ResearchSuite is not present in this workspace and was not touched.
**Predecessors:** `docs/AS-P0-SECURITY-006-CENTRAL-BILLING-ARCHITECTURE-REPORT.md`, `docs/AS-P0-SECURITY-006A-PRODUCT-BILLING-CONTAINMENT-REPORT.md`

**Labels:**

| Label | Meaning |
|---|---|
| **VERIFIED** | Observed directly |
| **IMPLEMENTED** | Code written |
| **TESTED** | Executed tests prove it |
| **INFERRED** | Concluded from verified facts |
| **RECOMMENDED** | Proposed, not built |
| **MISSING EVIDENCE** | Not reachable from here |
| **BLOCKED** | Cannot proceed until something changes |
| **REQUIRES APPROVAL** | Needs an owner decision |

---

## 1. Executive summary

**The migration-governance gate did not pass, so no migration was created and no repository `schema.prisma` was changed.** Repository and database evidence contradicts the brief's premise that central platform data lives in `craftsuite.platform` (section 4):

- **The portal's billing tables are in a separate database (`uamsatech`) and have never had a migration history.** The schema is managed by `prisma db push`, and the database has no `_prisma_migrations` table.
- **No `platform`, `lecture`, `scholar` or `research` schema exists**, and no repository is configured for multiple schemas.
- **LectureSuite and ScholarSuite share one `public._prisma_migrations` table** in `craftsuite`, holding both products' different baselines.
- **The live portal database has out-of-band DDL** that `schema.prisma` does not describe.

Placing the new tables requires an approved governance decision (section 4.4, G1–G3).

**Everything that does not depend on that decision was completed:**

1. **Complete additive data model (RECOMMENDED; validated).**
    - 10 new tables, 14 enums, invoice purchase-time snapshots, and **provider-scoped invoice ids (D7)**.
    - Built as a **proposed** schema in the scratchpad, accepted by `prisma validate`, and turned into SQL **offline** with `prisma migrate diff`. That SQL is purely additive; its only `DROP` is the D7 index replacement.
    - A supplementary constraint script adds partial unique indexes, CHECKs and triggers: seat capacity, one live grant at a time, immutable grant windows, no self-issued grants, and append-only audit.
2. **Validated against real PostgreSQL 18.4 (TESTED).**
    - The scripts were applied to a **throwaway database** created for the run on the loopback development server, then dropped (confirmed).
    - **56 of 56 behavioural assertions pass**, including a **genuine two-connection race for the last seat (exactly one wins)**.
    - No existing database was written to.
3. **Implemented and tested (portal; pure, not yet wired):**
    - the period-ledger reconstruction algorithm;
    - refund and dispute adjudication;
    - the multi-source entitlement decision (paid, licence, trial, operator).

    **68 tests**, including a 120-permutation order-independence property test, and **9 of 9 mutation checks caught**. The live 006A decision path is **unchanged**, because it cannot consult tables that do not exist yet.

**Regression results:**

| Repository | Result |
|---|---|
| Portal | **310 pass** |
| LectureSuite | **170 pass** |
| ScholarSuite | **141 pass** |

Typecheck, lint and build pass. No production connection, migration, `db push`, backfill, deployment, commit or push occurred.

**Recommendation for the next phase: CONDITIONAL GO** (section 22). Proceed once the migration-governance decision is approved. AS-P0-SECURITY-008 needs the tables in a development database first.

---

## 2. Repository and working-tree safety verification (VERIFIED)

| Repository | Branch | HEAD (start = end) | Staged | Unstaged | Untracked | Stashes | Worktrees |
|---|---|---|---|---|---|---|---|
| `uamsatech/` | `master` | `abd27e51b111519764af8e0416f6d814abc770ef` | 0 | 12 | 20 → 24 | 0 | 1 |
| `LectureCraft/` | `main` | `c821e6ca7f7de04cade0b00f7ad1e9784e13c906` | 0 | 128 | 13 | 0 | 1 |
| `ScholarCraft/` | `master` | `642513423dd91aface44b05986b70082b0666964` | 0 | 39 | 8 | 0 | 1 |

**Start manifests** (SHA-256 of every modified and untracked file): portal 32 files, LectureSuite 141, ScholarSuite 42. The counts match the end state of AS-P0-SECURITY-006A exactly.

**End state:**

- **0 hash mismatches** in all three repositories.
- **New files (portal only):** `lib/billing/domain/period-ledger.ts`, `lib/billing/domain/adjustments.ts`, `lib/billing/domain/entitlement-sources.ts`, `tests/unit/billing-domain.test.ts`, and this report.
- **LectureSuite and ScholarSuite: no file changed.**
- The portal's `prisma/` is unchanged (0 changes, no `migrations/` directory).

**Protected LectureSuite files** are unchanged:

- `invoice.service.ts`: `f501986c0f3dbf61`
- `stripe.provider.ts`: `72350add0889698b`
- `flutterwave.provider.ts`: `e271e83363dce737`

**Pre-existing deletions:** five ScholarSuite files, `frontend/__check_session.mjs` and `__phase1_{audit,console,login_once,trace}.mjs`, were deleted before AS-P0-SECURITY-006 and cannot be hash-verified. They are not changes made by this phase.

**Database access in this phase:**

- **Read-only sessions:** each verified the loopback address and `default_transaction_read_only = on` before any query. They covered the local `uamsatech` and `craftsuite` databases, and the `postgres` maintenance database for listings.
- **Throwaway validation databases:** `CREATE DATABASE as_p0_007_validation_<random>`, run on the loopback server **4 times**. Each was dropped with `DROP DATABASE … WITH (FORCE)`, and every drop was confirmed. A final read-only check found **0 leftover** databases, and 16 databases in total, the same as before.
- **No production connection.**

**Credential exposure note:** the first validation attempt failed before running anything because of a path-quoting error. Its error message printed the **local development** Postgres connection URL, including the password, into this session's tool output. It was not written to any repository file or report. The script was then changed to pass the URL only through the environment and to redact credentials from all errors. **Recommendation:** rotate the local `postgres` password if this session transcript is shared.

---

## 3. Existing model inventory (VERIFIED from the live local catalog and `prisma/schema.prisma`)

Portal database `uamsatech`, schema `public` (the only schema). Prisma maps models to snake_case tables.

| Model | Table | PK | Foreign keys | Unique | Status and provider fields | Consumers |
|---|---|---|---|---|---|---|
| `User` | `users` | `id` | — | `email` | — | auth, portal |
| `Organization` | `organizations` | `id` | — | `slug` | — | 6 files |
| `Membership` | `memberships` | `id` | `userId → users` (CASCADE), `organizationId → organizations` (CASCADE) | `(userId, organizationId)` | `role` `UserRole` (`OWNER`, `ADMIN`, `MEMBER`). **No status or expiry field** | 8 files; entitlement |
| `Product` | `products` | `id` | — | `slug` | — | — |
| `Plan` | `plans` | `id` | — | `key` | — | — |
| `ProductPlan` | `product_plans` | `id` | `productId`, `planId` (RESTRICT) | `(productId, planId)` | `interval`, `priceCents`, `currency`, `stripePriceId`; `paystackPlanCode` and `flutterwavePlanId` are **unused** | 4 files |
| `Subscription` | `subscriptions` | `id` | `productId` (RESTRICT); `productPlanId`, `userId`, `couponId`, `organizationId` (SET NULL) | `(organizationId, productId)`, `(userId, productId)`, `providerSubscriptionId` | `status` (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`), `currentPeriodEnd`, `cancelAtPeriodEnd`. **Also `CHECK (("organizationId" IS NOT NULL) <> ("userId" IS NOT NULL))`, which exists in the database but not in `schema.prisma`** | 11 files; entitlement, webhooks |
| `Invoice` | `invoices` | `id` | `subscriptionId → subscriptions` (RESTRICT). `organizationId` and `userId` have **no foreign key** | **`providerInvoiceId` (global)** | `status` (`OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`), `provider`, `paidAt`, `periodStart`, `periodEnd`. **No plan reference** | 4 files; webhooks |
| `Coupon` | `coupons` | `id` | — | `code` | — | checkout |
| `AuditLog` | `audit_logs` | `id` | `userId`, `organizationId` (SET NULL) | — | `action`, `metadata` (Json) | 5 files |

**Absent, and verified absent:**

- a payment or transaction model separate from `Invoice`;
- a provider webhook event store;
- refund, dispute, entitlement-period, licence, seat, trial-grant and operator-grant models;
- any organization-to-institution mapping;
- product role assignments in the portal (those live in the products' `user_product_roles`).

**Central staff authority:** the `ADMIN_EMAILS` allowlist (`lib/env.ts`, `lib/admin/auth.ts` `isAdminEmail`). This is the only existing central-operator concept.

**Local data volumes** (development): 16 users, 4 organizations, 3 memberships, 5 products, 14 product plans, 3 subscriptions, **1 invoice** (Stripe, no `providerInvoiceId`) and 64 audit logs.

---

## 4. Migration-governance findings

### 4.1 Facts (VERIFIED)

| Item | Portal | LectureSuite | ScholarSuite |
|---|---|---|---|
| `prisma/schema.prisma` datasource | `postgresql`, `env("DATABASE_URL")`; no `schemas`, no `multiSchema` preview feature | same | same |
| `prisma/migrations/` | **none** | `20260726180520_baseline`, `20260809000000_add_class_connect` | `20260728162436_baseline` |
| Schema change scripts | **`db:push` = `prisma db push`**; `db:migrate` = `migrate dev` | `migrate dev`, `migrate deploy` | `migrate dev`, `migrate deploy` |
| Local database (identity verified, read-only) | **`uamsatech`**, schemas: `public` only | `craftsuite`, schemas: `public` only | `craftsuite` (shared) |
| `_prisma_migrations` | **absent**, so the schema was never migration-managed | **`public._prisma_migrations`, shared with ScholarSuite**, containing `20260726180520_baseline` (LS), `20260728162436_baseline` (SS) and `20260809000000_add_class_connect` (LS) | same table |
| Table count (local) | 32 | 99 (shared) | 99 (shared) |

**Other observations:**

- The local server also holds databases named `lecturercraft`, `scholarcraft`, `thesiscraft`, `uamsa`, `uamsa_db` and `uamsa_test`, plus **7 orphaned `prisma_migrate_shadow_db_*` databases** from earlier `migrate dev` runs. None of these is mine, and none was touched.
- **No ResearchSuite repository** exists in this workspace. Its `db push` usage could not be inspected (**MISSING EVIDENCE**).
- **Production topology** (Neon project, which database the production portal uses, whether `platform` exists there) is **MISSING EVIDENCE**.

### 4.2 Consequences

1. **The portal cannot simply "add a migration".** It has never had a migration history. The first portal migration needs a **baseline** that is marked as already applied in every environment. That is an environment-wide operation, which is **REQUIRES APPROVAL**.
2. **Configuration does not support placing the new tables in `craftsuite.platform`.**
    - The new tables need foreign keys to `users`, `organizations`, `products`, `product_plans`, `subscriptions` and `invoices`, which live in the **`uamsatech` database**.
    - PostgreSQL foreign keys cannot cross databases.
    - Putting only the new tables in `craftsuite.platform` would break referential integrity, which the ledger, refund and dispute guarantees depend on.
3. **Schema drift exists.** The `subscriptions` CHECK constraint is in the database but not in `schema.prisma`, so it was added out-of-band. A baseline generated from `schema.prisma` would not match the live database exactly, and `db push` behaviour against it is uncontrolled.
4. **The products' shared history table** is a separate, pre-existing conflict (AS-P0-SECURITY-002 and -006). It is unaffected by any portal-only stream, but it stays unresolved.

### 4.3 Determination

**Migration ownership for the central billing schema is not established. No migration was generated into any repository, and no repository schema was edited (BLOCKED).** Per brief section 16, the model and SQL design was completed and validated outside the repositories instead.

### 4.4 Governance options and recommendation (REQUIRES APPROVAL)

**G1. Where the central platform schema lives.**

- **Option A (RECOMMENDED): the portal database is the platform database, with its own independent migration stream.**
    - The new tables sit beside the existing portal tables, so all foreign keys hold.
    - The stream is fully independent of the products' histories, because it lives in a different database.
    - This matches what the code and data are today.
- **Option B: move the portal into `craftsuite`, schema `platform`.**
    - Prisma `multiSchema`, a datasource URL with `?schema=platform`, and a separate `platform._prisma_migrations`.
    - This needs a **cross-database data migration** of every portal table, which is out of scope and high-risk.
    - Choose it only if a single database is a hard requirement. If chosen, it must be its own phase, and the products' `public._prisma_migrations` conflict must be untangled as well.

**G2. Baseline procedure (Option A), per environment, in order:**

1. Read-only `prisma migrate diff --from-url <env> --to-schema-datamodel prisma/schema.prisma`. The result must be empty apart from accepted drift.
2. Add the drift (the `subscriptions` CHECK) to the baseline as hand-written SQL.
3. Commit `prisma/migrations/<ts>_baseline/` generated by `migrate diff --from-empty`.
4. `prisma migrate resolve --applied <ts>_baseline` in each existing environment.
5. **Retire `db:push`** from `package.json`.

Only then is the 007 additive migration generated with `migrate dev --create-only` against a development database.

**G3. Ownership rules.**

- The **portal repository alone** owns the platform schema.
- A product repository never migrates it, and the portal never migrates `lecture`, `scholar` or `research`.
- Production migrations run only through a reviewed `migrate deploy` step, never `db push`.

---

## 5. Payment-to-entitlement ledger design

**Model: `EntitlementPeriod` → `entitlement_periods` (RECOMMENDED; DDL VALIDATED).**

| Aspect | Design |
|---|---|
| Links | `subscriptionId → subscriptions` (RESTRICT), `invoiceId → invoices` (RESTRICT), `productId → products` (RESTRICT) |
| Uniqueness | `@@unique([invoiceId, subscriptionId])`. A payment buys at most one period **per subscription**, so replays cannot double-credit. One payment may later fund several products' subscriptions (bundles) without a schema change |
| Index | `(subscriptionId, paidAt, invoiceId)`, the deterministic reconstruction order |
| Purchase-time snapshot | `interval` (one-off), `productPlanIdSnapshot`, `amountCents`, `currency`. The new `invoices` columns are `productPlanId` (FK, SET NULL), `planInterval`, `priceCentsSnapshot`, `couponIdSnapshot` and `verifiedAt`. **Historical payments keep the terms they were bought under** |
| Provider window (Stripe) | `providerPeriodStart` and `providerPeriodEnd`, taken as-is |
| State | `state` (`ACTIVE`, `SUSPENDED`, `REVOKED`, `PENDING_REVIEW`), with `stateReason`, `stateSourceRefundId` and `stateSourceDisputeId` |
| Checks | `periodEnd > periodStart`; `amountCents >= 0` |

**Reconstruction algorithm (IMPLEMENTED + TESTED in `lib/billing/domain/period-ledger.ts` `reconstructPeriods`):**

1. **Order:** take every verified payment of the subscription, ordered by `(paidAt, invoiceId)`. This is a total order, so the result is independent of delivery order.
2. **One-off payments (Paystack, Flutterwave)** are folded with carry-forward: `start = max(paidAt, cursor)` and `end = start + interval`, where `interval` is the **snapshot**.
    - **`REVOKED`** (full refund, lost dispute or reversal) is **skipped**: it occupies no time, and each later payment slides earlier while keeping its **full purchased duration**.
    - **`SUSPENDED`** (open dispute) **stays in the chain**, so its time remains reserved and later periods do not shift into it, but it **does not entitle**.
    - **`PENDING_REVIEW`** (partial refund) entitles; no automatic revocation.
3. **Provider periods (Stripe)** keep Stripe's own window. Revoked ones occupy no time. No arithmetic is ever applied to them.
4. **`coverageAt(periods, now)`:** access exists if an entitling period contains `now`. `until` is the end of the **contiguous** run of entitling periods, which is the session cap. A suspended period ends the run.
5. **`latestEntitlingEnd`** produces the value cached in `subscriptions.currentPeriodEnd`. Launch and verification keep working unchanged.

**Transaction boundary (RECOMMENDED, for when it is wired):**

1. Inside **one database transaction**, take `SELECT … FOR UPDATE` on the subscription row. This is the pattern already used in AS-P0-SECURITY-005.
2. Insert the verified payment and its period row.
3. Rebuild every period of that subscription with `reconstructPeriods`.
4. Update the changed `periodStart`, `periodEnd` and `state` values.
5. Update `subscriptions.currentPeriodEnd`.
6. Append `entitlement_changes` and `audit_logs`.
7. Commit.

Concurrent payments therefore serialise, and a failure rolls everything back for the provider to retry.

**Verified properties (TESTED, `tests/unit/billing-domain.test.ts` › "payment-period ledger"):**

- correct single period;
- early renewal carry-forward;
- a renewal after expiry starts at the payment time;
- the interval snapshot is used, not the current plan;
- **all 120 permutations of a 5-payment ledger are identical**;
- a late older payment never shortens entitlement;
- two payments together both count;
- a full refund removes only that payment, and later payments keep their duration;
- multiple full refunds are each handled;
- a suspended period is reserved but not entitling;
- a dispute on a later payment leaves earlier access intact;
- contiguous coverage, gaps and expiry;
- Stripe windows are taken as-is;
- a duplicate payment in one ledger is rejected.

**Multiple products and institution-sponsored payments:** ledgers are **per subscription**, which is already one per payer per product. An organization's subscription has its own ledger. Products never share a chain.

---

## 6. Refund model

**`PaymentRefund` → `payment_refunds` (RECOMMENDED; DDL VALIDATED).**

- **Fields:** `provider`, `providerRefundId`, `invoiceId → invoices` (RESTRICT), `amountCents` (CHECK > 0), `currency`, `status` `RefundStatus` (`REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELED`, `REVERSED`), `providerStatus` (the raw provider value), `requestedAt`, `completedAt`, `failedAt`, `failureClass` (a safe classification, not provider text), `providerUpdatedAt`, `verifiedAt` and `history` (Json, append-only transitions).
- **Constraint:** `@@unique([provider, providerRefundId])`. Provider-scoped, so a duplicate delivery updates rather than inserts, and the same id under different providers does not collide. Both behaviours were **TESTED in PostgreSQL**.
- **Index:** `(invoiceId, status)`.

**Adjudication (IMPLEMENTED + TESTED, `lib/billing/domain/adjustments.ts`):**

- **`summarizeRefunds`:**
    - Takes the latest **verified** version of each `(provider, providerRefundId)` and sums only `SUCCEEDED` refunds, so duplicates can never inflate the total.
    - `REQUESTED`, `PENDING`, `FAILED`, `CANCELED` and `REVERSED` do not count.
    - The result is `NONE`, `PARTIAL` or `FULL`, where FULL means the cumulative refunds reach the payment amount.
    - A refund in a different currency is routed to review.
- **`nextRefundStatus`:** an older event never regresses a record. `FAILED`, `CANCELED` and `REVERSED` are final. `SUCCEEDED` can move only to `REVERSED`.
- **Effect:** a full refund means `REVOKED`; a partial refund means `PENDING_REVIEW` (manual review); a failed refund means no change; a **refunded Stripe renewal** means `PENDING_REVIEW`, never cancellation; a **verified reversal** is treated as a full refund (`reversalAsRefund`).

---

## 7. Dispute model

**`PaymentDispute` → `payment_disputes` (RECOMMENDED; DDL VALIDATED).**

- **Fields:** `provider`, `providerDisputeId`, `invoiceId → invoices`, `amountCents` (CHECK > 0), `currency`, `status` `DisputeStatus` (`OPEN`, `UNDER_REVIEW`, `WON`, `LOST`, `CLOSED`, `UNKNOWN`), `providerStatus` (raw), `openedAt`, `resolvedAt`, `evidenceDueBy`, `evidenceSubmittedAt`, `providerUpdatedAt`, `verifiedAt` (required), `suspendedPeriodId → entitlement_periods` (SET NULL) and `history`.
- **Constraint:** `@@unique([provider, providerDisputeId])`.

**Normalisation (`normalizeDisputeStatus`):**

- **Stripe, verified against stripe@22 `Dispute.Status`:**
    - `needs_response` and `warning_needs_response` → `OPEN`;
    - `under_review` and `warning_under_review` → `UNDER_REVIEW`;
    - `won` → `WON` and `lost` → `LOST`;
    - `warning_closed` and `prevented` → `CLOSED`.
- **Paystack and Flutterwave vocabularies are MISSING EVIDENCE**, because they have not been verified against live payloads. Every unmapped value becomes `UNKNOWN`, which **changes no entitlement** and goes to manual review.

**Effect:**

- Only **verified** disputes count.
- `OPEN` or `UNDER_REVIEW` means the affected payment is `SUSPENDED`.
- `WON` or `CLOSED` restores it, but only as far as *this* dispute is concerned; another open dispute keeps it suspended.
- `LOST` means `REVOKED`.
- `nextDisputeStatus`: older events never regress, resolutions are final, and `UNKNOWN` never overwrites a known status.
- **Only the disputed payment is affected.** Other payments, products and entitlement sources are not, and this is tested.

---

## 8. Provider event and idempotency model

**Existing:** no event store exists. Idempotency today relies on `invoices.providerInvoiceId` plus Stripe re-fetch (AS-P0-SECURITY-004 and -005).

**`ProviderEvent` → `provider_events` (RECOMMENDED; DDL VALIDATED):**

- **Fields:** `provider`, `providerEventId`, `eventType`, `verification` (`UNVERIFIED`, `VERIFIED`, `REJECTED`), `processing` (`RECEIVED`, `PROCESSING`, `APPLIED`, `IGNORED`, `DUPLICATE`, `FAILED`), `attempts`, `errorClass`, `payloadSha256`, `facts` (Json, **minimised**), optional links to `invoiceId`, `refundId` and `disputeId` (SET NULL), `receivedAt`, `verifiedAt` and `processedAt`.
- **Constraint:** `@@unique([provider, providerEventId])`. A duplicate delivery is rejected at insert (**TESTED**). The same id under another provider is distinct (**TESTED**).
- **Index:** `(processing, receivedAt)` for the retry sweeps.
- **Paystack and Flutterwave event ids:** these providers have no global event id, so the key is derived, for example `event + data.id`, or `event + reference + status`.

**Data minimisation:**

- No raw payload is stored; only the hash and the minimal `facts`: ids, amount, currency, status and timestamps.
- Never stored: secrets, card or bank data, emails beyond what the ledger needs, or tokens.
- **Retention (RECOMMENDED):** purge `facts` after 18 months and keep the row and hash. Access is portal-server only.

**Out-of-order and concurrency:**

- Adjustments are **derived** from the full verified set (`adjudicatePayment`), so arrival order does not matter (**TESTED**).
- Persistence runs under the subscription row lock in one transaction (section 5).
- There are no in-memory locks.

---

## 9. Institutional licence model

**`InstitutionLicence` → `institution_licences` (RECOMMENDED; DDL VALIDATED):**

- **Fields:** `linkId → organization_institution_links`, `productId → products`, `licenceType` (`INSTITUTION_WIDE` or `SEAT_BASED`), `status` (`PENDING`, `ACTIVE`, `SUSPENDED`, `REVOKED`, `EXPIRED`), `startsAt`, `endsAt`, `productPlanId` (tier), `seatCapacity`, `sourceSubscriptionId → subscriptions` (the commercial source) and `issuedById → users`.
- **Index:** `(linkId, productId, status)`.
- **CHECKs (TESTED):**
    - `endsAt > startsAt`;
    - **`SEAT_BASED` requires `seatCapacity > 0`**;
    - **`INSTITUTION_WIDE` requires `seatCapacity IS NULL`**.

**Eligibility (IMPLEMENTED + TESTED, `evaluateLicenceSource`):**

- The licence must be product-matched, `ACTIVE` and within its window.
- It must have a **verified** link for the same product.
- The user must be a verified central `Membership` of the linked organization.
- Seat-based licences also require an **active seat**.

**Tested outcomes:**

| Case | Result |
|---|---|
| Institution-wide licence, member | Granted |
| Non-member | Denied |
| Expired | Denied |
| Suspended | Denied |
| Revoked | Denied |
| Other product | Denied |
| Unverified, missing or other-product link | Denied |
| Seat-based, no seat | Denied |
| Seat-based, with seat | Granted |
| Seat holder who is no longer a member | Denied |

**Existing institution billing records** (product-side `institution_subscriptions`) are **not used, not migrated and not treated as licences**.

**REQUIRES APPROVAL: what makes a member eligible.** `Membership` has no status or expiry. Today "active member" means a membership row exists, with any role. Whether `MEMBER`, `ADMIN` and `OWNER` all qualify, or eligibility needs its own flag, is undecided.

---

## 10. Organization-to-institution mapping

**`OrganizationInstitutionLink` → `organization_institution_links` (RECOMMENDED; DDL VALIDATED).**

- **Fields:** `organizationId → organizations`, `productId → products`, `productInstitutionId` (the product's institution id), `status` (`PENDING`, `VERIFIED`, `REVOKED`), `verificationMethod` (`PRODUCT_OWNER_CHALLENGE` or `OPERATOR_EVIDENCE`), `challengeSha256` and `challengeExpiresAt`, `requestedById`, `verifiedById`, `verifiedAt`, `revokedAt`, `revokedById` and `revokeReason`.
- **Partial unique indexes (TESTED):**
    - **one live link per `(productId, productInstitutionId)`**;
    - **one live link per `(organizationId, productId)`**.

    Revoked links remain as history. An organization may link a different institution in each product (**TESTED**).
- **CHECKs (TESTED):**
    - `VERIFIED` requires a verifier, a time and a method;
    - **the verifier must differ from the requester** (two-party).
- **Never inferred from names or email domains.** No field allows it.

**Verification process (RECOMMENDED; REQUIRES APPROVAL on the method):**

- **`PRODUCT_OWNER_CHALLENGE`:**
    1. A portal organization `OWNER` requests the link.
    2. The portal issues a one-time challenge; only its SHA-256 is stored, with a 24-hour expiry.
    3. An **institution owner in the product** confirms it through the product's authenticated server-to-server call, using the 006A product-bound service credential.
- **`OPERATOR_EVIDENCE`:** a central operator verifies documented evidence and records it.

---

## 11. Seat allocation model

**`LicenceSeat` → `licence_seats` (RECOMMENDED; DDL VALIDATED):**

- **Fields:** `licenceId`, `userId`, `status` (`ACTIVE` or `RELEASED`), `assignedAt`, `assignedById`, `releasedAt`, `releasedById` and `releaseReason`.
- **Partial unique index:** one **ACTIVE** seat per `(licenceId, userId)`. Released seats are kept as history.
- **CHECK:** `ACTIVE` means `releasedAt IS NULL`; `RELEASED` means `releasedAt IS NOT NULL`.
- **Database ceiling (trigger `licence_seats_capacity_trg`, function `licence_seats_enforce_capacity`):**
    1. On insert or activation, it takes `SELECT … FOR UPDATE` on the licence row.
    2. It refuses if the licence is not `SEAT_BASED` (`seat_on_non_seat_licence`), is not `ACTIVE` (`seat_on_inactive_licence`), or is full (`seat_capacity_exhausted`).
    3. This sits behind the application's own row lock as defense in depth.

**TESTED in PostgreSQL 18.4:**

| Case | Result |
|---|---|
| Two seats within a capacity of 2 | Accepted |
| A third seat | Rejected |
| A duplicate active seat for the same member | Rejected |
| Releasing a seat, then reassigning it | Accepted |
| A seat on an institution-wide licence | Rejected |
| A seat on a suspended licence | Rejected |
| **Two concurrent transactions racing for the last seat** (separate connections, both holding their transaction open) | **Exactly one succeeds; the other gets `seat_capacity_exhausted`; 1 active seat results** |

**Rules:**

- A seat is never created by login. Assignment is an explicit central action by an authorised organization administrator or an operator.
- The assignee must be a member of the linked organization. This is an application rule, **RECOMMENDED** to be checked at assignment time.
- Every change is audited.

---

## 12. Operator grant model

**`OperatorGrant` → `operator_grants` (RECOMMENDED; DDL VALIDATED):**

- **Fields:** `userId`, `productId`, `status` (`ACTIVE` or `REVOKED`), `reason`, `issuedById`, `approvedById`, `startsAt`, **`endsAt` (required, so no permanent grant)**, `revokedAt`, `revokedById` and `revokeReason`.
- **Never creates** a subscription, invoice or payment. It is a separate table with no commercial relations.

**Constraints and triggers (TESTED):**

- **not self-issued** (`issuedById <> userId`);
- the approver differs from both the grantee and the issuer;
- `endsAt > startsAt`;
- **at most 90 days** (REQUIRES APPROVAL on the length);
- **one active grant per (user, product)**;
- revocation requires an actor and a time;
- **the window is immutable**, so extending means a new explicit grant;
- **revocation is final** (`grants_window_immutable` trigger).

**Who may issue and revoke (RECOMMENDED; REQUIRES APPROVAL):**

- Only central operator administrators: today, the `ADMIN_EMAILS` allowlist, evaluated server-side in the portal.
- A product administrator role never issues or implies an operator grant. No product path exists, and the evaluator takes **no role input at all**.
- **Two-person rule recommended:** `approvedById` required in production. The schema supports it; making the column mandatory is the decision to take.

**Evaluation (IMPLEMENTED + TESTED, `evaluateOperatorSource`):**

- Valid only for its product and its user, `ACTIVE`, within the window, not self-issued, from an authorised issuer.
- Tested denials: other product, expired, revoked, self-issued, unauthorised issuer, other user.

---

## 13. Trial authorization model

**`TrialGrant` → `trial_grants` (RECOMMENDED; DDL VALIDATED):**

- **Fields:** `productId`, `targetType` (`USER` or `INSTITUTION`), `userId` **or** `linkId` (exactly one), `status`, `startsAt`, `endsAt`, `reason`, `authorizedById`, `revokedAt`, `revokedById` and `revokeReason`.

**Constraints and triggers (TESTED):**

- exactly one target;
- `endsAt > startsAt`;
- **at most 30 days** (REQUIRES APPROVAL on the length);
- a user cannot authorise their own trial;
- **one active trial per (product, user)** and per (product, link);
- **immutable window, so non-renewing:** extension requires a new authorisation, and the trigger rejects editing `endsAt`;
- revocation requires an actor and is final.
- An institution-sponsored trial references a link, and evaluation requires that link to be **VERIFIED**.

**Rules:**

- No automatic trial.
- No client or product chooses the duration; only the central authoriser does, within the CHECK.
- Products cannot create trials (006A disabled every product trial path).
- A legacy `TRIALING` status grants nothing (**TESTED**: `evaluateSubscriptionSource` returns `trial_not_authorized`).

**Evaluation (`evaluateTrialSource`, TESTED):**

- Grants within its window.
- Expired or revoked trials deny.
- A trial for another product denies.
- A self-authorised trial denies.
- An institution trial needs a verified link and membership.

**Combination with paid access:** a trial never overrides paid access. When both are valid, the paid source is reported as primary, and access lasts while either is valid (section 14).

---

## 14. Central entitlement decision changes

**Live decision (VERIFIED, unchanged):** `lib/portal/entitlement.ts` `resolveProductEntitlement`, used by `/api/portal/launch/[product]` and `/api/internal/entitlements/verify`, which in turn serve product login, register and refresh (006A). It evaluates paid subscriptions only. **Not modified in this phase:** the licence, trial and operator tables do not exist yet, and pointing the live decision at them is impossible until the migration is applied.

**New combined policy (IMPLEMENTED + TESTED, not wired):** `lib/billing/domain/entitlement-sources.ts`.

- **Evaluators:** `evaluateSubscriptionSource`, which uses the ledger through `coverageAt`; `evaluateLicenceSource`; `evaluateTrialSource`; `evaluateOperatorSource`. Each returns `{ source, sourceId, valid, reason, until }`.
- **`combineEntitlement`:**
    - **Granted if any source is valid.** An invalid source never cancels a valid one.
    - The primary source is reported with the precedence **SUBSCRIPTION > LICENCE > TRIAL > OPERATOR**, so paid access is never masked by a trial.
    - `until` is the latest end among the valid sources. Each source is independent, and every refresh re-verifies.
    - **Every source is reported** with its own verdict.
    - When nothing is valid, the most specific denial is reported: SUSPENDED > REVOKED > EXPIRED > DENIED, or NONE when there is no source.

**Combination tests (TESTED):**

- paid alone grants;
- **a dispute on a payment does not remove a valid licence**;
- **or a valid operator grant**;
- **a revoked payment does not remove another payment's period**;
- paid has precedence over a trial;
- licence and paid together last until the later end;
- all sources are reported;
- 7 denial combinations: suspended payment, revoked payment, expired licence, past due, canceled, suspended licence with a revoked grant, and no source;
- another product's entitlement never authorises this one;
- an administrator role is not a source.

**Wiring plan (RECOMMENDED, AS-P0-SECURITY-008):**

- `resolveProductEntitlement` becomes a loader that fetches the four sources for (user, product) and calls `combineEntitlement`.
- The 006A contract stays **v1-compatible**, and these fields are added: `source`, `sources[]`, and `paidThrough = until`.
- The products need no change. They already treat SUSPENDED and REVOKED as deny.

---

## 15. Provider-scoped invoice identifier changes (D7)

- **Current state (VERIFIED):** a global unique index `invoices_providerInvoiceId_key` on `invoices(providerInvoiceId)`.
- **Proposed change (RECOMMENDED; VALIDATED):**
    - `DROP INDEX "invoices_providerInvoiceId_key"`, then `CREATE UNIQUE INDEX "invoices_provider_providerInvoiceId_key" ON invoices (provider, "providerInvoiceId")`.
    - This is the only `DROP` in the generated SQL. It relaxes nothing within a provider, and no historical identifier is rewritten.
- **Null policy:** PostgreSQL's default `NULLS DISTINCT`, so invoices without a provider id (allowed today) may repeat (**TESTED**).
- **TESTED in PostgreSQL:**
    - the same id under different providers is accepted;
    - the same id under the same provider is rejected;
    - repeated NULLs are accepted.
- **Duplicate check (VERIFIED, local only):**
    - 1 invoice, 0 with a provider id;
    - no `(provider, id)` duplicates;
    - no cross-provider collisions.
- **Production:** **MISSING EVIDENCE.** Before applying, run the same read-only queries (section 19).
- **Coupled code change (DEFERRED):** `lib/billing/one-time-payment.ts` and the Stripe webhook use `invoice.findUnique({ where: { providerInvoiceId } })`. They must switch to the compound key `provider_providerInvoiceId` **in the same release** as the migration. The type-checker will enforce this once the client is regenerated.

---

## 16. Security and audit controls

| Requirement | Control | Status |
|---|---|---|
| Every entitlement change audited (actor, action, product, subject, source, before and after, reason, provider reference, timestamp, correlation id) | `EntitlementChange` → `entitlement_changes`: `productId`, `subjectUserId` or `subjectOrganizationId`, `source` and `sourceId`, `action`, `reason`, `actorType` and `actorId`, `before` and `after` (Json), `providerEventId`, `correlationId` and `createdAt`. **No foreign keys**, so history survives deletions. **UPDATE and DELETE are blocked** by a trigger | DDL TESTED |
| Unverified provider events cannot change entitlement | Adjudication drops `verified: false`; `ProviderEvent.verification` | TESTED (domain) |
| No frontend action grants entitlement | All grant tables are written only by portal server actions behind central-admin checks; products have no write path (006A) | RECOMMENDED (enforced when wired) |
| Product administrators cannot issue operator access | No product path; evaluator has no role input; issuer must be an authorised central operator; not self-issued (DB CHECK) | TESTED |
| A failed refund cannot revoke; a partial refund does not auto-revoke | `adjudicatePayment` | TESTED |
| A dispute cannot affect unrelated products | Per-subscription ledgers; product checks in every evaluator | TESTED |
| Audit failure must not permit a change | The audit insert happens in the same transaction as the change, so a failure rolls back (AS-P0-SECURITY-005 pattern) | RECOMMENDED |
| No tokens or secrets in logs | Minimised `facts`; no payloads; validation tooling redacts credentials (section 2 note) | RECOMMENDED / IMPLEMENTED (tooling) |
| Grants bounded and non-renewing | Max length CHECKs; immutable-window trigger; final revocation | TESTED |

---

## 17. Schema and migration details

**No migration file was created** (section 4: BLOCKED).

The design artifacts are persisted in **`docs/AS-P0-SECURITY-007-design/`**. The `.proposal` suffixes keep tooling and reviewers from mistaking them for a live schema or migration. The folder's `README.md` has the exact reproduction commands. Generated outputs (`proposed.prisma`, `additive.sql`) are recreated from them on demand:

| Artifact | Lines | SHA-256 (prefix) | How produced |
|---|---|---|---|
| `additions.prisma` | 359 | `dbf6a64335675c69` | Hand-written models and enums (Appendix A) |
| `proposed.prisma` | — | — | Generated on demand by `build.cjs.proposal`: the repository `schema.prisma` (read-only) plus the additions, the Invoice changes and back-relations |
| `additive.sql` | 421 | `f18be5f073f7b0f8` | `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel proposed.prisma --script`, run **offline** |
| `supplement.sql` | 133 | `07eba9ba739cb0fe` | Hand-written partial indexes, CHECKs and triggers (Appendix B) |
| `validate.cjs.proposal` | — | — | Throwaway-database validator (section 18) |

**Generated SQL inspection (VERIFIED):**

- 14 `CREATE TYPE`, 10 `CREATE TABLE`, 14 `CREATE INDEX`, 5 `CREATE UNIQUE INDEX`, 34 `ADD CONSTRAINT` (foreign keys), and 1 `ALTER TABLE "invoices" ADD COLUMN …` (the five nullable snapshot columns).
- **The only `DROP`:** `DROP INDEX "invoices_providerInvoiceId_key"` (D7).
- **No** `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN` or type change on any existing table.
- Every new column on an existing table is nullable, so no backfill is needed to deploy.

**New tables (all in the same schema as the existing portal tables, `public` of the portal database under Option A):**

- `provider_events`
- `entitlement_periods`
- `payment_refunds`
- `payment_disputes`
- `organization_institution_links`
- `institution_licences`
- `licence_seats`
- `trial_grants`
- `operator_grants`
- `entitlement_changes`

**Unique constraints:**

| Kind | Constraint | Columns |
|---|---|---|
| Prisma | `provider_events_provider_providerEventId_key` | `(provider, providerEventId)` |
| Prisma | `entitlement_periods_invoiceId_subscriptionId_key` | `(invoiceId, subscriptionId)` |
| Prisma | `payment_refunds_provider_providerRefundId_key` | `(provider, providerRefundId)` |
| Prisma | `payment_disputes_provider_providerDisputeId_key` | `(provider, providerDisputeId)` |
| Prisma | `invoices_provider_providerInvoiceId_key` | `(provider, providerInvoiceId)` |
| Partial (supplement) | `org_inst_links_live_product_institution_key` | `(productId, productInstitutionId)` |
| Partial (supplement) | `org_inst_links_live_org_product_key` | `(organizationId, productId)` |
| Partial (supplement) | `licence_seats_active_member_key` | `(licenceId, userId)` |
| Partial (supplement) | `trial_grants_one_active_user_key` | `(productId, userId)` |
| Partial (supplement) | `trial_grants_one_active_link_key` | `(productId, linkId)` |
| Partial (supplement) | `operator_grants_one_active_key` | `(userId, productId)` |

**Compatibility:** validated on PostgreSQL **18.4** (local). Neon's PostgreSQL version is **MISSING EVIDENCE**. The SQL uses only PL/pgSQL triggers, partial indexes and CHECKs, all available since PostgreSQL 9.x, and `EXECUTE FUNCTION`, which needs version 11 or later.

**Intended migration filenames, once governance is approved** (not created):

- `prisma/migrations/<ts>_baseline/migration.sql` (G2);
- `prisma/migrations/<ts>_as_p0_007_central_billing_foundation/migration.sql`, containing `additive.sql` followed by `supplement.sql`.

---

## 18. Tests and validation results

| # | Command or suite | Result |
|---|---|---|
| 1 | `prisma validate --schema proposed.prisma` (dummy unreachable `DATABASE_URL`) | **PASS** |
| 2 | `prisma migrate diff` (offline): current to proposed, and empty to current | **PASS** (SQL generated) |
| 3 | `validate.cjs` in a throwaway database (PostgreSQL 18.4) | **PASS: 56 of 56** |
| 4 | `vitest run tests/unit/billing-domain.test.ts` | **PASS: 68 of 68** |
| 5 | Domain mutation checks D1–D9 (revoked still occupies time; suspended entitles; no carry-forward; non-succeeded refunds counted; unverified evidence accepted; lost dispute ignored; one invalid source denies all; seats ignored; unauthorised issuer) | **9 of 9 caught** (4, 6, 7, 6, 2, 1, 2, 1 and 1 failures); restored, 0 markers |
| 6 | Portal `vitest run` (full) | **PASS: 13 files, 310 tests** (242 previously, plus 68) |
| 7 | Portal `tsc --noEmit` | **PASS** |
| 8 | Portal `eslint lib/billing lib/portal app/api tests/unit` | **PASS** |
| 9 | Portal `next build` | **PASS** (exit 0) |
| 10 | LectureSuite `jest --runInBand` | **PASS: 170** (unchanged; 006A intact) |
| 11 | ScholarSuite `jest --runInBand` | **PASS: 141** (unchanged) |

**What the throwaway-database validation covered:**

- clean application of the baseline, additive and supplement SQL;
- the D7 cases;
- the ledger uniqueness and window checks;
- partial refunds, duplicate refunds and cross-provider refunds;
- refund amount checks;
- disputes linked to a suspended period, and duplicate disputes;
- event idempotency per provider;
- link uniqueness, verification fields and the two-party rule;
- the licence seat-model CHECKs;
- seats: capacity, release and reassignment, wrong licence type, suspended licence, duplicate member, **the concurrent race**;
- trials: target, maximum length, self-authorisation, one active, per product, immutable window, revocation fields, finality, institution-sponsored;
- operator grants: self-issue, maximum length, approver, one active, immutable;
- audit: insert allowed, UPDATE and DELETE blocked;
- footprint: exactly 10 new tables.

**Not run:** provider sandboxes (no credentials) and any production check (no access).

---

## 19. Unresolved data conflicts

1. **Out-of-band DDL.** The `subscriptions` CHECK constraint is in the live database but not in `schema.prisma`. Other environments may have different drift. Run a read-only `migrate diff --from-url` per environment before the baseline (**MISSING EVIDENCE** outside local).
2. **The products' shared `public._prisma_migrations`** holds two baselines, a pre-existing unresolved conflict.
3. **Production invoice duplicates** for D7 have not been checked (**MISSING EVIDENCE**). Read-only checks to run first:

    ```sql
    SELECT provider, "providerInvoiceId", count(*) FROM invoices
     WHERE "providerInvoiceId" IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;   -- must be empty
    SELECT "providerInvoiceId", count(DISTINCT provider) FROM invoices
     WHERE "providerInvoiceId" IS NOT NULL GROUP BY 1 HAVING count(DISTINCT provider) > 1;  -- informational
    ```

    Any duplicates go to a reconciliation report, with no automatic merge.
4. **Legacy invoices** (before AS-P0-SECURITY-004) carry invented periods and no plan reference. When building `entitlement_periods` from history, they must be treated as `PENDING_REVIEW` or reconciled with the provider (AS-P0-SECURITY-010), **never** trusted.
5. **Seven orphaned `prisma_migrate_shadow_db_*` databases** exist on the local server. Housekeeping only; untouched.

---

## 20. Deferred work

| Item | Phase |
|---|---|
| Governance decision G1–G3; portal baseline migration; retire `db:push` | **AS-P0-SECURITY-007B (new)** |
| Apply the 007 migration to a **development** database; regenerate the client; switch to the compound invoice key | AS-P0-SECURITY-007B |
| Persistence services: ledger writes under row lock, the refund and dispute processors, seat allocation service, link verification flow, trial and operator grant administration UI and API with central-admin checks | AS-P0-SECURITY-008 |
| Wire `combineEntitlement` into `resolveProductEntitlement` (contract v1 plus `source` and `sources`) | AS-P0-SECURITY-008 |
| Verify Paystack and Flutterwave refund and dispute vocabularies in sandboxes | AS-P0-SECURITY-008 and -011 |
| Legacy subscription, invoice and ledger reconciliation | AS-P0-SECURITY-010 |
| ResearchSuite integration on the same contract | Later |

## 21. Production-readiness blockers

1. **Migration governance (G1–G3) not approved.** No central billing table can be created anywhere until it is.
2. **Production topology unknown:** which database the production portal uses, its PostgreSQL version, and any drift.
3. **Every AS-P0-SECURITY-006A deployment prerequisite** is still open: service secrets, the compose environment, release order, the operator-access path. The operator-access path now has a designed solution here, but it is not built.
4. Product-plan and policy decisions: trial maximum (30 days proposed), operator grant maximum (90 days proposed), two-person approval, member eligibility, link verification method.
5. Carried over: provider sandboxes, production read access, the backfill, the Paystack currency, the role-identifier correction, and the products' migration-history conflict.

## 22. Final recommendation

**CONDITIONAL GO for the next phase**, on these conditions:

- **(a)** approve **G1 Option A**, or explicitly choose Option B and accept the cross-database migration phase;
- **(b)** approve the G2 baseline procedure and G3 ownership rules;
- **(c)** decide the four policy values in section 21, item 4.

With those approved, run a short **AS-P0-SECURITY-007B**. It turns this validated design into the portal's baseline plus the additive migration, applied to a **development database only**. Then AS-P0-SECURITY-008 (processing and wiring) can proceed.

**AS-P0-SECURITY-008 is NO-GO until 007B is done**, because it needs the tables to exist in development. This phase authorised no production deployment or backfill, and none occurred.

---

## Appendix A — Proposed additive Prisma models (`additions.prisma`, design artifact)

Enums: `EntitlementPeriodState`, `RefundStatus`, `DisputeStatus`, `ProviderEventVerification`, `ProviderEventProcessing`, `InstitutionLinkStatus`, `InstitutionLinkVerification`, `LicenceType`, `LicenceStatus`, `SeatStatus`, `GrantStatus`, `TrialTarget`, `EntitlementSource` and `EntitlementActorType` (values as in sections 5–16).

```prisma
model ProviderEvent {
  id              String                    @id @default(cuid())
  provider        BillingProvider
  providerEventId String
  eventType       String
  verification    ProviderEventVerification @default(UNVERIFIED)
  processing      ProviderEventProcessing   @default(RECEIVED)
  attempts        Int                       @default(0)
  errorClass      String?
  payloadSha256   String
  facts           Json?
  invoiceId       String?   // → Invoice (SetNull)
  refundId        String?   // → PaymentRefund (SetNull)
  disputeId       String?   // → PaymentDispute (SetNull)
  receivedAt      DateTime  @default(now())
  verifiedAt      DateTime?
  processedAt     DateTime?
  @@unique([provider, providerEventId])
  @@index([processing, receivedAt])
  @@map("provider_events")
}

model EntitlementPeriod {
  id String @id @default(cuid())
  subscriptionId String   // → Subscription (Restrict)
  invoiceId      String   // → Invoice (Restrict)
  productId      String   // → Product (Restrict)
  paidAt DateTime
  interval PlanInterval?
  providerPeriodStart DateTime?
  providerPeriodEnd   DateTime?
  periodStart DateTime
  periodEnd   DateTime
  state EntitlementPeriodState @default(ACTIVE)
  stateReason String?
  stateSourceRefundId  String?
  stateSourceDisputeId String?
  productPlanIdSnapshot String?
  amountCents Int
  currency    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([invoiceId, subscriptionId])
  @@index([subscriptionId, paidAt, invoiceId])
  @@map("entitlement_periods")
}

model PaymentRefund {
  id String @id @default(cuid())
  provider BillingProvider
  providerRefundId String
  invoiceId String          // → Invoice (Restrict)
  amountCents Int
  currency String
  status RefundStatus @default(REQUESTED)
  providerStatus String?
  requestedAt DateTime?
  completedAt DateTime?
  failedAt DateTime?
  failureClass String?
  providerUpdatedAt DateTime
  verifiedAt DateTime?
  history Json @default("[]")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([provider, providerRefundId])
  @@index([invoiceId, status])
  @@map("payment_refunds")
}

model PaymentDispute {
  id String @id @default(cuid())
  provider BillingProvider
  providerDisputeId String
  invoiceId String          // → Invoice (Restrict)
  amountCents Int
  currency String
  status DisputeStatus @default(OPEN)
  providerStatus String
  openedAt DateTime
  resolvedAt DateTime?
  evidenceDueBy DateTime?
  evidenceSubmittedAt DateTime?
  providerUpdatedAt DateTime
  verifiedAt DateTime
  suspendedPeriodId String? // → EntitlementPeriod (SetNull)
  history Json @default("[]")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([provider, providerDisputeId])
  @@index([invoiceId])
  @@map("payment_disputes")
}

model OrganizationInstitutionLink {
  id String @id @default(cuid())
  organizationId String     // → Organization (Restrict)
  productId String          // → Product (Restrict)
  productInstitutionId String
  status InstitutionLinkStatus @default(PENDING)
  verificationMethod InstitutionLinkVerification?
  challengeSha256 String?
  challengeExpiresAt DateTime?
  requestedById String      // → User "LinkRequestedBy"
  verifiedById String?      // → User "LinkVerifiedBy"
  verifiedAt DateTime?
  revokedAt DateTime?
  revokedById String?       // → User "LinkRevokedBy"
  revokeReason String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([organizationId, productId])
  @@index([productId, productInstitutionId])
  @@map("organization_institution_links")
}

model InstitutionLicence {
  id String @id @default(cuid())
  linkId String             // → OrganizationInstitutionLink (Restrict)
  productId String          // → Product (Restrict)
  licenceType LicenceType
  status LicenceStatus @default(PENDING)
  startsAt DateTime
  endsAt DateTime
  productPlanId String?     // → ProductPlan (Restrict)
  seatCapacity Int?
  sourceSubscriptionId String? // → Subscription (Restrict)
  issuedById String         // → User "LicenceIssuedBy"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([linkId, productId, status])
  @@map("institution_licences")
}

model LicenceSeat {
  id String @id @default(cuid())
  licenceId String          // → InstitutionLicence (Restrict)
  userId String             // → User "SeatHolder"
  status SeatStatus @default(ACTIVE)
  assignedAt DateTime @default(now())
  assignedById String       // → User "SeatAssignedBy"
  releasedAt DateTime?
  releasedById String?      // → User "SeatReleasedBy"
  releaseReason String?
  @@index([licenceId, status])
  @@index([userId])
  @@map("licence_seats")
}

model TrialGrant {
  id String @id @default(cuid())
  productId String          // → Product (Restrict)
  targetType TrialTarget
  userId String?            // → User "TrialUser"
  linkId String?            // → OrganizationInstitutionLink
  status GrantStatus @default(ACTIVE)
  startsAt DateTime
  endsAt DateTime
  reason String
  authorizedById String     // → User "TrialAuthorizedBy"
  revokedAt DateTime?
  revokedById String?       // → User "TrialRevokedBy"
  revokeReason String?
  createdAt DateTime @default(now())
  @@index([productId, userId])
  @@index([productId, linkId])
  @@map("trial_grants")
}

model OperatorGrant {
  id String @id @default(cuid())
  userId String             // → User "OperatorGrantee"
  productId String          // → Product (Restrict)
  status GrantStatus @default(ACTIVE)
  reason String
  issuedById String         // → User "OperatorIssuedBy"
  approvedById String?      // → User "OperatorApprovedBy"
  startsAt DateTime
  endsAt DateTime
  revokedAt DateTime?
  revokedById String?       // → User "OperatorRevokedBy"
  revokeReason String?
  createdAt DateTime @default(now())
  @@index([userId, productId, status])
  @@map("operator_grants")
}

model EntitlementChange {   // append-only; no FKs
  id String @id @default(cuid())
  productId String
  subjectUserId String?
  subjectOrganizationId String?
  source EntitlementSource
  sourceId String
  action String
  reason String
  actorType EntitlementActorType
  actorId String?
  before Json?
  after Json?
  providerEventId String?
  correlationId String?
  createdAt DateTime @default(now())
  @@index([productId, createdAt])
  @@index([source, sourceId])
  @@map("entitlement_changes")
}

// Invoice additions: productPlanId String? (→ ProductPlan, SetNull), planInterval PlanInterval?,
// priceCentsSnapshot Int?, couponIdSnapshot String?, verifiedAt DateTime?,
// providerInvoiceId loses @unique; adds @@unique([provider, providerInvoiceId]).
```

(The full file, with relation fields and back-relations, is reproduced by `docs/AS-P0-SECURITY-007-design/build.cjs.proposal`. Relation fields are abbreviated above as `// →` comments.)

## Appendix B — Supplementary constraints (`supplement.sql`, design artifact)

| Table | Objects |
|---|---|
| `entitlement_periods` | `entitlement_periods_window_chk` (`periodEnd > periodStart`), `entitlement_periods_amount_chk` (`amountCents >= 0`) |
| `payment_refunds` | `payment_refunds_amount_chk` (`amountCents > 0`) |
| `payment_disputes` | `payment_disputes_amount_chk` (`amountCents > 0`) |
| `organization_institution_links` | Partial unique `org_inst_links_live_product_institution_key` and `org_inst_links_live_org_product_key` (`WHERE status <> 'REVOKED'`); `org_inst_links_verified_chk`; `org_inst_links_two_party_chk` |
| `institution_licences` | `institution_licences_window_chk`, `institution_licences_seat_model_chk` |
| `licence_seats` | Partial unique `licence_seats_active_member_key` (`WHERE status = 'ACTIVE'`); `licence_seats_release_chk`; trigger `licence_seats_capacity_trg` → `licence_seats_enforce_capacity()` (locks the licence `FOR UPDATE`; raises `seat_on_non_seat_licence`, `seat_on_inactive_licence` or `seat_capacity_exhausted`) |
| `trial_grants` | `trial_grants_target_chk`, `trial_grants_window_chk`, `trial_grants_max_len_chk` (≤ 30 days), `trial_grants_self_chk`, `trial_grants_revoke_chk`; partial unique `trial_grants_one_active_user_key` and `trial_grants_one_active_link_key`; trigger `trial_grants_immutable_trg` |
| `operator_grants` | `operator_grants_window_chk`, `operator_grants_max_len_chk` (≤ 90 days), `operator_grants_not_self_issued_chk`, `operator_grants_approver_chk`, `operator_grants_revoke_chk`; partial unique `operator_grants_one_active_key`; trigger `operator_grants_immutable_trg` |
| Shared function | `grants_window_immutable()` rejects changes to `startsAt`, `endsAt` or `productId`, and un-revocation (`grant_window_immutable`, `grant_revocation_final`) |
| `entitlement_changes` | Trigger `entitlement_changes_append_only_trg` → `entitlement_changes_append_only()` blocks UPDATE and DELETE |
