# AS-P0-SECURITY-006 — Central Billing Authority, Refund and Dispute Architecture

**Date:** 4 November 2026
**Scope:** UAMSA Tech central portal (`uamsatech/`), LectureSuite (`LectureCraft/`), ScholarSuite (`ScholarCraft/`). ResearchSuite was not touched.
**Nature of this phase:** read-only architecture reconciliation. No code, schema, data, migration, deployment, commit or push was made. The only file created in any repository is this report.

Every statement carries one of these labels:

| Label | Meaning |
|---|---|
| **[VERIFIED]** | Read directly in code, schema, or a read-only query whose output is quoted |
| **[INFERENCE]** | A conclusion drawn from verified facts, not observed directly |
| **[RECOMMENDATION]** | A proposed design or action, **not implemented** |
| **[MISSING EVIDENCE]** | Could not be established from what was reachable |
| **[DECISION]** | Needs an owner decision before it can be built |

---

## 1. Executive summary

1. **There are three billing systems, not two.** The portal has one. LectureSuite and ScholarSuite each carry a copy of the same second system, byte-identical apart from four branding strings. Both copies point at **one shared database** (`craftsuite`), so they read and write the **same** `institution_subscriptions`, `invoices` and `payments` tables. **[VERIFIED]**
2. **The product-side billing system enforces nothing on the server.** Its access middleware (`requireActiveSubscription`, `requireFeature`, `requireUsageCapacity`) is defined but **never applied to any route** in either product, and usage is never recorded. Product API access is granted by **possession of a product account** alone. **[VERIFIED]**
3. **The real commercial authority gap is account provisioning and session lifetime, not legacy subscription records.** A product account can be obtained or kept without central entitlement in four ways:
    - direct `/register` and `/register-institution` (open unless `DISABLE_DIRECT_SIGNUP` is set; it defaults to `false`);
    - `/login` with an existing account (no entitlement check);
    - refresh-token rotation, which issues a new 7-day token on every refresh with no entitlement or user-status check;
    - the portal dashboard's direct "Quick Launch" links, which bypass the entitlement-checked launch route.

    **[VERIFIED]**
4. **Critical security defect in the product billing API.** Any authenticated member of an institution, including a student, can call the following on behalf of the whole institution, because those routes check authentication only and **no role**:
    - `POST /api/billing/subscription` with an **unbounded, client-supplied `trialDays`**;
    - `PATCH /api/billing/subscription/upgrade`, which sets `ACTIVE` and syncs `planTier` **before any payment**;
    - `PATCH /api/billing/subscription/resume`, which sets `ACTIVE` with no payment.

    Today these records unlock no server-side feature (finding 2), but they show paid tiers in the UI and corrupt MRR and ARR statistics. They would become a free-upgrade exploit the moment any enforcement reads them. **[VERIFIED]**
5. **The portal schema cannot represent refunds, disputes, or which payment bought which period.**
    - `Invoice` stores no plan reference.
    - There is no provider-event store.
    - There is no adjustment record and no period ledger.
    - The approved refund and dispute policy needs an additive schema (section 9).

    **[VERIFIED]**
6. **No institution identity is federated.** The portal `Organization` and the product `Institution` share no identifier, and SSO-provisioned product users get `institutionId = null`. Institution-sponsored entitlement therefore cannot be carried into the products today. **[VERIFIED]**
7. **Legacy data:**
    - The local `craftsuite` database (confirmed loopback, read-only session) holds **0** institutions, plans, subscriptions, invoices and payments, so there is nothing to migrate locally.
    - **Production legacy data was not reachable.** **[MISSING EVIDENCE]**
    - The local database does show a user holding both `scholarcraft` and `scholarsuite` role rows. That is the identifier conflict predicted in AS-P0-SECURITY-002 section F, now observed on real data. **[VERIFIED]**

**Recommendation:**

1. Insert a small **containment phase (AS-P0-SECURITY-006A)** before AS-P0-SECURITY-007. It would lock the product billing write endpoints, make direct signup fail closed, and route dashboard launches through the entitlement check. It needs no schema change.
2. Then proceed with AS-P0-SECURITY-007 (schema) through AS-P0-SECURITY-011 as briefed, with the session-lifetime fix folded into AS-P0-SECURITY-009 (section 17).

---

## 2. Repository and working-tree safety verification

### 2.1 Starting state [VERIFIED]

| Repository | Worktrees | Branch | HEAD | Staged | Unstaged | Untracked | Stashes |
|---|---|---|---|---|---|---|---|
| `uamsatech/` | 1 (main) | `master` | `abd27e51b111519764af8e0416f6d814abc770ef` | 0 | 11 | 13 | 0 |
| `LectureCraft/` | 1 (main) | `main` | `c821e6ca7f7de04cade0b00f7ad1e9784e13c906` | 0 | 121 | 8 | 0 |
| `ScholarCraft/` | 1 (main) | `master` | `642513423dd91aface44b05986b70082b0666964` | 0 | 32 (5 are deletions) | 3 | 0 |

**Hash manifests.** A SHA-256 manifest of every modified and untracked file was written to the session scratchpad before any inspection:

- `uamsatech`: 24 files.
- `LectureCraft`: 129 files.
- `ScholarCraft`: 30 files. The 5 deleted files cannot be hashed.

**Protected LectureSuite files** (uncommitted user edits; read, never written):

| File | SHA-256 | Nature of the user edit |
|---|---|---|
| `backend/src/services/billing/invoice.service.ts` | `f501986c…d6af74` | Branding: "LectureCraft" becomes "LectureSuite" (2 lines) |
| `backend/src/services/billing/providers/stripe.provider.ts` | `72350add…b98c9d5` | Branding: the product name in the Stripe line item |
| `backend/src/services/billing/providers/flutterwave.provider.ts` | `e271e833…84ed6690` | Branding: the checkout title |

The portal's AS-P0-SECURITY-002, -004 and -005 work is present and uncommitted, for example `lib/portal/entitlement.ts` `5c0b3e1a…` and `lib/billing/stripe-sync.ts` `a0c05016…`. It was preserved.

### 2.2 Ending state

See section 21, which was filled in after the final verification.

### 2.3 Operations performed

**Performed:**

- `git status`, `diff`, `worktree list` and `ls-files`.
- File reads and `grep`.
- `prisma validate`, run with an **unreachable dummy `DATABASE_URL`** so that no connection was possible.
- Unit test suites. They use mocks and in-memory doubles and touch no database.
- `tsc --noEmit` and `eslint`.
- Two read-only SQL inventories against the **local** `craftsuite` database. Each script first ran `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`, then verified `default_transaction_read_only = on` **and** that `inet_server_addr()` is loopback (`::1/128`), and was coded to abort otherwise. Output: database `craftsuite`, PostgreSQL 18.4, server `::1`, port 5432.

**Not performed:** any write, migration, `db push`, deploy, commit, push, stash, reset, restore, checkout or reformat. There was no production connection and no provider API call.

---

## 3. Existing billing implementation inventory

### 3.1 Central portal (`uamsatech/`) [VERIFIED]

**Schema** (`prisma/schema.prisma`):

| Model or enum | Key fields | Notes |
|---|---|---|
| `Product` | `slug` (unique) | Catalog slugs `lecturercraft` and `scholarcraft` are still in use (AS-P0-SECURITY-002) |
| `Plan` | `key` (unique) | Tier names: free, starter, professional, enterprise |
| `ProductPlan` | `productId`, `planId`, `interval` (`MONTHLY`, `YEARLY`), `priceCents`, `currency` (default `USD`), `stripePriceId`, `paystackPlanCode`, `flutterwavePlanId`, `isActive`; `@@unique([productId, planId])` | **One price and one currency per product-plan, shared by every provider.** `paystackPlanCode` and `flutterwavePlanId` are never read or written by any code |
| `Subscription` | `organizationId?` or `userId?`, `productId`, `productPlanId?`, `couponId?`, `status` (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`), `provider?`, `providerCustomerId?`, `providerSubscriptionId` (unique), `currentPeriodEnd?`, `cancelAtPeriodEnd`; `@@unique([organizationId, productId])`, `@@unique([userId, productId])` | One row per payer per product. No trial-grant, seat, licence or revocation fields |
| `Invoice` | `subscriptionId` (foreign key), `organizationId?` and `userId?` (**no foreign key**, denormalised), `amountCents`, `currency` (default `NGN`), `status` (`OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`), `provider`, `providerInvoiceId` (unique), `periodStart`, `periodEnd`, `paidAt?` | Acts as the **payment record**. Has **no `productPlanId`**, so it cannot say which plan a payment bought |
| `Coupon` | `discountType` (`PERCENT`, `FIXED`), `discountValue`, `currency?`, `stripeCouponId`, `paystackCouponId` (unused) | |
| `UsageRecord` | | Display only |
| `AuditLog` | `userId?`, `organizationId?`, `action` (String), `metadata` (Json) | Generic. Billing now writes `billing.*` actions here (AS-P0-SECURITY-005) |
| `Organization`, `Membership` | `Membership.role` (`OWNER`, `ADMIN`, `MEMBER`) | No institution type, licence or seat concept |

**Provider integrations** (as left by AS-P0-SECURITY-004 and -005):

| Provider | Checkout | Webhook | Verification | Persists paid-through | Refund or dispute |
|---|---|---|---|---|---|
| Stripe | `app/api/billing/stripe/checkout/route.ts`, `mode: subscription` | `app/api/billing/stripe/webhook/route.ts` | `constructEvent`, then a locked re-fetch through `lib/billing/stripe-sync.ts` | Yes: `item.current_period_end`, only when active and the latest invoice is paid | Acknowledged and ignored |
| Paystack | `app/api/billing/paystack/checkout/route.ts`, one-off, now sends `currency` | `app/api/billing/paystack/webhook/route.ts` (`charge.success` only) | HMAC-SHA512, timing-safe, with a verify-API fallback | Yes: carry-forward chain (`lib/billing/one-time-payment.ts`) | Ignored, cannot extend |
| Flutterwave | `app/api/billing/flutterwave/checkout/route.ts`, one-off | `app/api/billing/flutterwave/webhook/route.ts` (`charge.completed` only) | `verif-hash` (timing-safe), then `GET /transactions/{id}/verify` | Yes: carry-forward chain | Ignored, cannot extend |

**Entitlement:** `lib/portal/entitlement.ts` (`evaluateSubscription` and `resolveProductEntitlement`) is called by `app/api/portal/launch/[product]/route.ts` before `signLaunchToken`. The audit is mandatory: a grant that cannot be audited returns 503.

### 3.2 LectureSuite (`LectureCraft/backend/`) and ScholarSuite (`ScholarCraft/backend/`) [VERIFIED]

**Identical code:** `controllers/billing/`, `middleware/billing/`, `workers/billing.worker.ts` and `routes/billing.routes.ts` are byte-identical across the two products (`diff -r --strip-trailing-cr`). `services/billing/` differs only by the four user branding edits above.

**Shared database:** both `.env.example` files and both local `.env` files point to the database `craftsuite`. **[VERIFIED for config; production values are MISSING EVIDENCE]**

**Schema** (both products):

| Model or enum | Key fields | Notes |
|---|---|---|
| `SubscriptionPlan` (`subscription_plans`) | `slug` (unique), `billingCycle`, `price` Decimal(12,2), `currency` (default `USD`), limits (`maxUsers`, `maxCourses`, `monthlyAITokens`…), flags | **No product field** |
| `InstitutionSubscription` (`institution_subscriptions`) | `institutionId` **@unique**, `planId`, `status` `BillingStatus` (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELLED`, `EXPIRED`, `PAUSED`), `startDate`, `endDate?`, `autoRenew`, `cancelledAt?`, `renewalDate?`, `currentPeriodStart`, `currentPeriodEnd` (required), `trialEndsAt?`, `couponId?`, `externalCustomerId?`, `externalSubId?` | **One subscription per institution across both products.** Neither product can tell whose subscription it is |
| `Invoice` (`invoices`) | `institutionId`, `subscriptionId`, `invoiceNumber` (unique), `amount`, `tax` and `total` (Decimal), `currency`, `status` (`DRAFT`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`), `dueDate`, `paidAt?`, `lineItems` (Json) | |
| `Payment` (`payments`) | `invoiceId`, `institutionId`, `paymentProvider` (`STRIPE`, `PAYSTACK`, `FLUTTERWAVE`, `MANUAL`), `transactionReference?` (**not unique**), `amount`, `status` (`PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `CANCELLED`), `providerMetadata` (Json), `paidAt?` | `REFUNDED` is **never set** by any code |
| `Coupon`, `CouponRedemption`, `UsageRecord`, `FeatureFlag`, `APIKey` | | |
| `Institution` | `planTier` `PlanTier` (default `FREE`), `tenantStatus` (default `TRIAL`), `maxUsers` | `planTier` is written only by `syncInstitutionTier` and read only for display |

**Services, routes and workers:**

- `services/billing/subscription.service.ts`: `createSubscription`, `upgradeSubscription`, `cancelSubscription`, `resumeSubscription`, `renewSubscription`, `processExpiredTrials` and `syncInstitutionTier`.
- `services/billing/payment.service.ts`: `initiatePayment` and `handleWebhook`.
- `services/billing/providers/{stripe,paystack,flutterwave}.provider.ts`.
- `routes/billing.routes.ts`, mounted at `/api/billing` (`app.ts:139`), with webhooks at `/api/billing/webhooks/{stripe,paystack,flutterwave}` (`app.ts:78`).
- `workers/billing.worker.ts` (BullMQ):
    - `expire-trials`, scheduled daily at `0 2 * * *`;
    - `renew-subscription`, **never enqueued by anything**, so it is dead code;
    - `generate-invoice`;
    - `aggregate-usage`, scheduled hourly.

---

## 4. Central portal versus product billing comparison

| Capability | Central Portal | LectureSuite | ScholarSuite | Target Authority |
|---|---|---|---|---|
| Plan management | Implemented (`Plan`, `ProductPlan`; seeded) | Implemented (`SubscriptionPlan`; 0 rows locally) | Duplicate (shared table) | Portal |
| Commercial pricing | Implemented (`priceCents`, one currency per product-plan) | Conflicting (`Decimal` price, no product dimension) | Duplicate | Portal |
| Subscription creation | Implemented (provider webhooks only) | **Conflicting.** A self-service API creates `ACTIVE` or `TRIALING` subscriptions without payment (`subscription.service.ts:41-105`) | Duplicate | Portal |
| Institution subscriptions | Partial (`Organization` subscription, membership = authorisation) | Conflicting (`InstitutionSubscription`, one per institution, no product) | Duplicate | Portal (needs a licence model) |
| Checkout | Implemented (3 providers) | Implemented (`paymentService.initiatePayment`, pays a product invoice) | Duplicate | Portal |
| Stripe | Implemented (subscription mode; AS-P0-SECURITY-005 sync) | Partial (one-off checkout for an invoice; `constructEvent`) | Duplicate | Portal |
| Paystack | Implemented (one-off; amount, currency and plan verification) | Partial (HMAC-SHA512 with a non-timing-safe `!==`; no amount check) | Duplicate | Portal |
| Flutterwave | Implemented (`verif-hash` plus a verify API) | **Requires further inspection.** It computes an HMAC-SHA256 of the body and compares it with the header (`flutterwave.provider.ts:39-46`), a different scheme from the portal's; the expected Flutterwave scheme must be confirmed in a sandbox | Duplicate | Portal |
| Webhook processing | Implemented (idempotent, atomic, audited) | Partial. **Not idempotent** (a new `Payment` row on every delivery); **no amount verification**; any `succeeded` marks the invoice `PAID` and flips `PAST_DUE` to `ACTIVE` | Duplicate | Portal |
| Payment records | Partial (`Invoice` doubles as the payment record; no plan reference) | Implemented (`Payment` and `Invoice`) | Duplicate | Portal |
| Invoice generation | Implemented (on payment) | Implemented (`invoiceService.generateInvoice`, unpaid invoices due in 7 days) | Duplicate | Portal |
| Paid-through date | Implemented (AS-P0-SECURITY-004 and -005) | Conflicting (`currentPeriodEnd` set by date arithmetic on create, upgrade, resume and renew, **without payment**) | Duplicate | Portal |
| Trial management | Implemented as **deny** (`TRIALING` denied; no grant record) | **Conflicting.** An automatic 14-day trial on paid plans, plus a client-controlled `trialDays` | Duplicate | Portal (explicit grants) |
| Cancellation | Implemented (Stripe `cancel_at_period_end` and `deleted`) | Implemented (self-service; immediate or at period end) | Duplicate | Portal |
| Refunds | Missing (events ignored, cannot extend) | Missing (`REFUNDED` enum unused) | Missing | Portal |
| Disputes | Missing | Missing | Missing | Portal |
| Entitlement decisions | Implemented (launch-time only) | **Missing server-side.** Middleware is defined but unapplied; access is granted by account possession | Missing server-side | Portal; products consume |
| Audit logs | Implemented (`AuditLog`; `billing.*` and `product.launch_*`) | Missing for billing (`AuditLog` exists for other actions; not inspected for billing) | Same | Portal |

---

## 5. Current commercial authority map

Every place that currently grants or denies product access **[VERIFIED]**:

| # | Location | What it decides | Commercial check? |
|---|---|---|---|
| 1 | Portal `app/api/portal/launch/[product]/route.ts` | Whether a launch token is minted | **Yes**: product-specific, fail-closed, audited |
| 2 | Portal `app/portal/products/page.tsx` | Shows the Launch button | UI only (any subscription row) |
| 3 | Portal `app/portal/dashboard/page.tsx:167` | "Quick Launch" `href="https://{subdomain}"` | **None: bypasses #1** |
| 4 | Portal `app/api/auth/me` with `lib/auth/cors.ts` (allows `*.uamsatech.com`) | A shared-cookie session check, documented in `docs/12-product-integration.md` | None. **Not consumed by either product**, so it is a dormant parallel SSO path |
| 5 | Product `GET /api/auth/sso` (`authController.ssoCallback`) | Verifies the launch token, then provisions the account and product role | Trusts #1 |
| 6 | Product `POST /api/auth/register`, `/register-institution` | Creates accounts directly | **None.** Blocked only if `DISABLE_DIRECT_SIGNUP` is truthy; the schema default is `false` (`config/env.ts`), so unset means open |
| 7 | Product `POST /api/auth/login` | Issues a product session | **None** |
| 8 | Product `rotateRefreshToken` (`services/auth/jwt.service.ts`) | Renews the session | **None.** A new 7-day refresh token on every rotation; no entitlement or user-status check, so sessions last indefinitely |
| 9 | Product `authenticate` middleware | API access | JWT validity only |
| 10 | Product `requireActiveSubscription`, `requireFeature`, `requireUsageCapacity` | Would gate features | **Not applied anywhere.** `requireActiveSubscription` would also allow when there is no subscription, or when it is `TRIALING` or `PAST_DUE` |
| 11 | Product `GET /api/billing/features/:feature` | Reports a flag | Informational |
| 12 | Product frontends `features/billing/pages/BillingPage.tsx` | Displays plan and status | Display only. No route guards on plan or tier were found |
| 13 | Product worker `expire-trials` | `TRIALING` becomes `PAST_DUE` | Changes records only; gates nothing |

**Independent commercial authorities:**

- **[VERIFIED]** No product API enforces any commercial rule.
- **[INFERENCE]** The *de facto* authorities are rows 6, 7 and 8: account provisioning and session renewal. The legacy `InstitutionSubscription` is a **shadow authority**. It presents paid or trial status to users and administrators and can be self-granted (section 7), but nothing enforces it.

---

## 6. Database relationship analysis

### 6.1 Portal: can a payment be tied to customer, product, subscription, plan, period and institution?

| Link | Status |
|---|---|
| Payment to subscription | **Reliable.** `Invoice.subscriptionId` is a foreign key. **[VERIFIED]** |
| Payment to customer | **Indirect.** It goes through `Subscription.organizationId` or `userId`. `Invoice.organizationId` and `userId` are unconstrained copies. **[VERIFIED]** |
| Payment to product | **Indirect.** It goes through `Subscription.productId`. **[VERIFIED]** |
| Payment to plan | **Missing.** `Invoice` has no `productPlanId`. Only the subscription's *current* plan is known, and it changes on upgrade, so a past payment's plan is lost. **[VERIFIED]** Today it is reconstructable only from the period length of AS-P0-SECURITY-004/005 invoices (`intervalOfPeriod`). **[INFERENCE]** |
| Payment to billing period | **Partial.** The period start and end are stored on `Invoice`. They are true slots for invoices written after AS-P0-SECURITY-004. Older Paystack and Flutterwave invoices carry an **invented** "processing time + 1 month". **[VERIFIED]** |
| Payment to institution | **Missing.** The portal `Organization` is not a product `Institution` and no mapping exists. **[VERIFIED]** |
| Provider events | **Missing.** No event store exists, so idempotency relies on `Invoice.providerInvoiceId` (unique) and Stripe re-fetch. **[VERIFIED]** |
| Entitlement periods | **Implicit.** It exists only as `Subscription.currentPeriodEnd` and invoice slots. There is no ledger. **[VERIFIED]** |
| Audit events | `AuditLog` (generic Json). It is not linked to `Subscription` by a foreign key. **[VERIFIED]** |

### 6.2 Products

- **Payment to subscription:** reliable through `Payment.invoiceId` and `Invoice.subscriptionId`. **[VERIFIED]**
- **Subscription to product:** **impossible**, because there is no product column and both products share the table. **[VERIFIED]**
- **Payment idempotency:** none. `transactionReference` is not unique, and there is no event id. **[VERIFIED]**
- **Duplicates observed locally:** none, because there is no billing data. **[VERIFIED]** For production: **[MISSING EVIDENCE]**.

### 6.3 Identity across systems

- The SSO launch token carries `sub` (portal user id) and `email`, and the product resolves users **by email**. **[VERIFIED]**
- SSO-provisioned product users get `institutionId = null`, so a product `Institution` and its billing never relate to a portal `Organization`. **[VERIFIED]**
- The product `user_product_roles` table (local) contains:
    - `lecturercraft`/LECTURER: 1 row;
    - `scholarcraft`/STUDENT: 2 rows;
    - `scholarsuite`/STUDENT: 1 row.

    One user (`…21qb4h`) holds both `scholarcraft` and `scholarsuite` rows. **[VERIFIED]**

---

## 7. Duplicate and conflicting billing paths

| # | Conflict | Evidence | Severity |
|---|---|---|---|
| C1 | **Free self-upgrade.** `PATCH /api/billing/subscription/upgrade` sets `status: 'ACTIVE'`, a new period and `planTier` before any payment. It only creates an invoice due in 7 days, and nothing reverts the change if the invoice is unpaid | `subscription.service.ts:107-145`; routes have `authenticate` only | **Critical** (latent; no enforcement reads it today) |
| C2 | **Client-controlled unlimited trial.** `trialDays` comes from `req.body` and has no maximum | `subscriptions.controller.ts:17-18`, `subscription.service.ts:72-76` | **Critical** (latent) |
| C3 | **Any member can manage the institution's subscription.** There is no `requireRole` on the "institution admin" routes | `routes/billing.routes.ts:31-60` | **High** |
| C4 | **Free resume.** `CANCELLED`/`PAUSED` becomes `ACTIVE` with a fresh period and no payment | `subscription.service.ts:162-183` | High (latent) |
| C5 | **Non-idempotent webhooks with no amount check.** Every delivery inserts a `Payment`, and any `succeeded` marks the invoice paid | `payment.service.ts:43-86` | High |
| C6 | **Shared table, two writers.** Both products' APIs and workers write the same `institution_subscriptions` rows, and `expire-trials` runs twice daily | Shared `craftsuite`; identical worker | Medium |
| C7 | **Two price catalogs.** Portal `ProductPlan.priceCents` versus product `SubscriptionPlan.price` (Decimal), with no linkage | Schemas | Medium |
| C8 | **Two SSO mechanisms.** The launch token (enforced) versus shared cookie + `/api/auth/me` (documented, dormant) | `docs/12-product-integration.md`, `app/api/auth/me` | Medium |
| C9 | **Dashboard launch bypass.** The dashboard links directly to the product subdomain | `app/portal/dashboard/page.tsx:167` | Medium |
| C10 | **Direct signup fail-open default** | `config/env.ts` `DISABLE_DIRECT_SIGNUP ... default(false)` | **High** |
| C11 | **Indefinite product sessions** | `jwt.service.ts rotateRefreshToken` | **High** |
| C12 | **Dead renewal code.** `renew-subscription` is never enqueued | `workers/billing.worker.ts` | Low |

---

## 8. Automatic trial inventory

| Product | Where created | Attached to | Repeatable? | Checked by backend middleware? | Trigger |
|---|---|---|---|---|---|
| LectureSuite | `subscriptionService.createSubscription`. Default `trialDays = price === 0 ? 0 : 14`, **or any client value** | Institution (`institutionId @unique`) | Once per institution by unique constraint, but the length is unbounded. **[VERIFIED]** After cancel, `resumeSubscription` gives `ACTIVE`, not a trial | **No** (middleware unapplied) | **Only** `POST /api/billing/subscription`, from any authenticated member. **Not** registration, onboarding or institution creation: the only caller is `subscriptionsController.create`. **[VERIFIED]** |
| ScholarSuite | Identical | Identical | Identical | Identical | Identical |
| Both | `Institution.tenantStatus` schema default `TRIAL` | Institution | Set implicitly when an institution is created | No (read only in `select`s for display) | Institution registration (schema default). **[VERIFIED schema default; creation path not traced line by line]** |
| Both | Worker `expire-trials` (daily 02:00) | Subscription | n/a | Changes `TRIALING` to `PAST_DUE` once `trialEndsAt` has passed | Cron, running twice because both products schedule it |
| Portal | **No trial creation.** `TRIALING` only arises from Stripe's status mapping, and entitlement denies it | n/a | n/a | Launch route denies | n/a |

---

## 9. Refund and dispute schema proposal **[RECOMMENDATION, not implemented]**

### 9.1 Design principles

1. **Additive only.** No existing column is altered or dropped, so legacy rows stay valid.
2. **A payment ledger, not booleans.** Refunds and disputes are child records of the payment they affect, each with its own lifecycle. "Refunded" is derived from `SUM(succeeded refunds) >= amount`.
3. **Provider-scoped identity.** Every provider identifier is unique **only together with its provider**. Stripe, Paystack and Flutterwave id spaces are independent and could in principle collide, so a global unique would wrongly merge them.
4. **Entitlement periods are materialised** as one row per entitling payment, so a refund or dispute targets exactly one period.

### 9.2 Proposed Prisma models (portal)

```prisma
enum AdjustmentType   { REFUND DISPUTE REVERSAL }
enum AdjustmentStatus {            // refund lifecycle     | dispute lifecycle
  PENDING                          // refund requested     |
  SUCCEEDED                        // refund completed     |
  FAILED                           // refund failed        |
  CANCELED                         // refund canceled      |
  OPEN                             //                      | dispute opened
  EVIDENCE_SUBMITTED               //                      | under review
  WON                              //                      | resolved for merchant
  LOST                             //                      | resolved for customer
  CLOSED                           //                      | withdrawn / closed without ruling (if provider supports)
}
enum PeriodState { ACTIVE SUSPENDED REVOKED }
enum ProviderEventOutcome { APPLIED DUPLICATE IGNORED UNVERIFIED FAILED }

model ProviderEvent {                       // every webhook delivery, verified or not
  id              String               @id @default(cuid())
  provider        BillingProvider
  providerEventId String               // Stripe evt_…, Paystack/Flutterwave: derived (event + data.id/reference)
  eventType       String
  receivedAt      DateTime             @default(now())
  verifiedAt      DateTime?            // set only after signature + API re-fetch succeeded
  outcome         ProviderEventOutcome
  detail          Json?                // ids/amounts only — never secrets, card data or tokens
  @@unique([provider, providerEventId])  // R1
  @@map("provider_events")
}

model PaymentAdjustment {
  id                   String           @id @default(cuid())
  invoiceId            String
  invoice              Invoice          @relation(fields: [invoiceId], references: [id])
  provider             BillingProvider
  providerAdjustmentId String           // re_… / dp_… / Paystack refund id / Flutterwave refund or chargeback id
  type                 AdjustmentType
  status               AdjustmentStatus
  amountCents          Int
  currency             String
  providerUpdatedAt    DateTime         // provider-confirmed time of THIS status (ordering guard)
  verifiedAt           DateTime         // when re-fetched from the provider API
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
  history              Json             @default("[]")  // append-only status transitions with timestamps
  @@unique([provider, providerAdjustmentId])  // R2
  @@index([invoiceId])
  @@map("payment_adjustments")
}

model EntitlementPeriod {                   // one row per entitling payment
  id             String       @id @default(cuid())
  subscriptionId String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
  invoiceId      String       @unique     // R3 — a payment buys exactly one period
  invoice        Invoice      @relation(fields: [invoiceId], references: [id])
  interval       PlanInterval?            // one-off payments; null for Stripe (Stripe-owned period)
  periodStart    DateTime
  periodEnd      DateTime
  state          PeriodState  @default(ACTIVE)
  stateReason    String?                  // FULL_REFUND | DISPUTE_OPEN | DISPUTE_LOST | REVERSAL | MANUAL
  stateSourceId  String?                  // PaymentAdjustment.id that caused the state
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  @@index([subscriptionId, periodStart])
  @@map("entitlement_periods")
}

model EntitlementChange {                   // append-only, queryable history
  id                       String              @id @default(cuid())
  subscriptionId           String
  cause                    String              // PAYMENT | REFUND | DISPUTE_OPENED | DISPUTE_WON | DISPUTE_LOST | REVERSAL | STRIPE_SYNC | MANUAL
  actor                    String              // "provider:stripe" | "provider:paystack" | "user:<id>" | "system"
  sourceRef                String?             // ProviderEvent.id / PaymentAdjustment.id / Invoice.id
  previousStatus           SubscriptionStatus?
  newStatus                SubscriptionStatus?
  previousCurrentPeriodEnd DateTime?
  newCurrentPeriodEnd      DateTime?
  createdAt                DateTime            @default(now())
  @@index([subscriptionId, createdAt])
  @@map("entitlement_changes")
}

// Additions to existing models (nullable → no backfill required to deploy):
//   Invoice.productPlanId  String?  (+ relation)   — plan bought by THIS payment
//   Invoice.interval       PlanInterval?           — snapshot, survives later plan edits
//   Invoice.refundedCents  Int @default(0)         — denormalised SUM(SUCCEEDED refunds), recomputed in-transaction
//   Invoice.adjustments    PaymentAdjustment[]
//   Subscription.periods   EntitlementPeriod[]
```

### 9.3 Why each unique constraint exists

| ID | Constraint | Reason |
|---|---|---|
| R1 | `ProviderEvent @@unique([provider, providerEventId])` | Drops duplicate webhook deliveries before any work is done. It is provider-scoped because each provider's event id space is independent. Paystack and Flutterwave have no globally unique event id, so the key is derived as `event + data.id`, or `event + reference + status` |
| R2 | `PaymentAdjustment @@unique([provider, providerAdjustmentId])` | One row per refund or dispute *object*. Multiple partial refunds are distinct objects with distinct ids, so they are tracked separately and summed. A status change updates the same row, so it never creates a second adjustment |
| R3 | `EntitlementPeriod.invoiceId @unique` | One payment buys at most one period, so replays cannot double-credit |
| (kept) | `Invoice.providerInvoiceId @unique` | Already the payment-level idempotency key (AS-P0-SECURITY-004). It is not provider-scoped today. **[DECISION]** Whether to replace it with `@@unique([provider, providerInvoiceId])` in AS-P0-SECURITY-007 |

### 9.4 Idempotency and ordering rules

- **Duplicates.** R1 discards the delivery, and R2 makes a re-applied status a no-op.
- **Out-of-order status changes.** Apply a status only if its `providerUpdatedAt` is not older than the stored one, and only if the transition is allowed:
    - `PENDING → SUCCEEDED | FAILED | CANCELED`;
    - `OPEN → EVIDENCE_SUBMITTED → WON | LOST | CLOSED`.

    Terminal states never regress.
- **Concurrency.** The `SELECT … FOR UPDATE` on the subscription row (already used in AS-P0-SECURITY-005) serialises all adjustments for one subscription.
- **Temporary database failure.** One transaction covers the event row, the adjustment, the period state, the chain rebuild, `EntitlementChange` and `AuditLog`. On failure everything rolls back, the endpoint returns 500, the provider retries, and R1 is not yet committed, so the retry proceeds.
- **Unverified events.** They are recorded as `ProviderEvent.outcome = UNVERIFIED`, with **no entitlement change**.

---

## 10. Entitlement-period reconstruction design **[RECOMMENDATION, not implemented]**

**Entitling payments for a subscription** = `Invoice` rows with `status = PAID` that have an `EntitlementPeriod` whose `state ≠ REVOKED`.

### 10.1 One-off payments (Paystack, Flutterwave)

1. Lock the subscription row.
2. Take every entitling payment's period row, ordered by `paidAt`.
3. Run the same carry-forward fold that AS-P0-SECURITY-005 uses: `start = max(paidAt, previous end)`, `end = start + interval`. The interval comes from `Invoice.interval`, the plan snapshot at purchase.
4. **Revoked periods are skipped.** They are not folded, so the payments after them move earlier to close the gap.
5. **Suspended periods are kept in the chain**, so their time is not handed to later payments while a dispute is open, but they are **not entitling**.
6. Write each surviving period's new `periodStart` and `periodEnd`, set `currentPeriodEnd` to the end of the last non-revoked period, and write an `EntitlementChange` with before and after values.

**How the approved rules map onto this:**

| Event | Treatment |
|---|---|
| Full refund (or reversal) of payment P | P's period becomes `REVOKED`, then the chain is rebuilt. Later payments keep their **full purchased duration** and only shift earlier, so rule 1 holds |
| Dispute opened on P | P's period becomes `SUSPENDED`. **[DECISION D1]** Whether "now" inside a suspended period denies access (proposed) or only flags it. Only P is affected, so rule 2 holds |
| Dispute won on P | `SUSPENDED → ACTIVE`, provided `stateSourceId` is that dispute |
| Dispute lost on P | `SUSPENDED → REVOKED`, then the chain is rebuilt |
| Partial refunds | Recorded and summed in `refundedCents`. The period is unchanged and the case is flagged for manual review. If the cumulative refunds reach the full amount, it is treated as a full refund |
| Failed refund | Recorded as `FAILED`, with no state change |

**Worked example (monthly plan):**

- A paid 1 Sep gets 1 Sep–1 Oct.
- B paid 20 Sep, an early renewal, gets 1 Oct–1 Nov.
- C paid 25 Oct gets 1 Nov–1 Dec.

Then A is fully refunded:

- A is `REVOKED`.
- B is rebuilt to 20 Sep–20 Oct, starting at its own `paidAt` because nothing precedes it.
- C becomes 25 Oct–25 Nov.
- `currentPeriodEnd` moves from 1 Dec to 25 Nov.

Nothing of B or C is lost. Only A's purchased month disappears, and B and C slide earlier into the time A no longer covers.

**Late earlier webhook:** the existing re-slot logic is unchanged. It inserts by `paidAt` and re-folds, and revoked periods are excluded from the fold.

### 10.2 Stripe (recurring)

- Stripe owns the period, so there is no carry-forward and no fold.
- Each paid Stripe invoice becomes a period row taken from its **line-item period**.
- `currentPeriodEnd` is the end of the latest `ACTIVE` period that is contiguous with "now". Still apply AS-P0-SECURITY-005's rule of an active subscription with a paid latest invoice.
- **Renewal invoice refunded:** manual review, with no automatic change (approved policy).
- **Dispute lost** on a renewal invoice: that period becomes `REVOKED`. Access ends at the start of that period if it covers now. **[DECISION D2]** Whether to also cancel the subscription in Stripe (approved policy: do not *automatically* cancel the whole subscription).

### 10.3 Multiple products and sources

- **Chains are per `Subscription`**, which is already one per payer per product. A refund on LectureSuite can never touch ScholarSuite.
- **Institution-sponsored access** is a different `Subscription` (`organizationId`). Sources are evaluated independently, and **time is never pooled across sources**, so an individual and an institutional subscription do not stack. The existing `resolveProductEntitlement` already grants on *any* entitling source. **[VERIFIED current behaviour]**

---

## 11. Central entitlement contract **[RECOMMENDATION]**

### 11.1 Decision payload (portal to product)

```json
{
  "v": 1,
  "product": "lecturesuite",
  "subject": { "portalUserId": "…", "email": "…" },
  "institution": { "portalOrganizationId": "… | null", "productInstitutionId": "… | null" },
  "decision": "GRANTED | DENIED",
  "status": "ACTIVE | SUSPENDED | REVOKED | EXPIRED | NONE",
  "source": "individual | institution | trial_grant",
  "entitlementType": "plan:<key> | trial | licence",
  "paidThrough": "2026-12-01T00:00:00Z",
  "reason": "no_subscription | expired | period_end_unknown | trial_not_authorized | past_due | canceled | suspended_dispute | revoked_refund | …",
  "decidedAt": "2026-11-04T12:00:00Z",
  "cacheUntil": "min(decidedAt + 5m, paidThrough)"
}
```

### 11.2 Transport

- **Launch time (exists):** the portal checks entitlement before signing. **[VERIFIED]**
- **Session time (missing):** add an authenticated server-to-server endpoint, for example `GET /api/internal/entitlements?product=&portalUserId=` on the portal.
    - Authenticate it with a **separate per-product service credential**. Do **not** reuse `CRAFT_LAUNCH_SECRET`, which must stay single-purpose (AS-P0-SECURITY-002), and do not reuse the product `JWT_ACCESS_SECRET`.
    - Products call it on login, on SSO and **on every refresh-token rotation**. This is the smallest point that closes C11 without per-request latency.

Adding claims to the launch token is an alternative, but it changes the SSO contract and only covers launch time. **[DECISION D3]**

### 11.3 Fail-closed matrix

| Situation | Product behaviour |
|---|---|
| Central authority reachable and returns GRANTED | Allow; cache until `cacheUntil` |
| Central authority returns DENIED, REVOKED or SUSPENDED | Deny immediately and drop cached grants |
| Network error, and a **valid cached GRANTED** (`now < cacheUntil` and `now < paidThrough`) | Allow until `cacheUntil`. A bounded outage tolerance of at most 5 minutes |
| Network error, and the cache is **expired or absent** | **Deny** (503 "entitlement temporarily unavailable"). Never allow on error |
| `paidThrough` has passed, whatever is cached | Deny |
| Malformed or unsigned response | Deny |

### 11.4 Smallest safe product-side change (for AS-P0-SECURITY-006A and -009)

1. `DISABLE_DIRECT_SIGNUP`: change the default to `true`, which fails closed (C10). The `z.coerce.boolean()` parsing should become an explicit `'true' | 'false'` enum.
2. Put the product billing **write** routes behind `requireRole('SUPER_ADMIN')` or disable them with 403 or 410: subscription create, upgrade, cancel and resume, and `payments/initiate` (C1–C4).
3. Re-check entitlement on `rotateRefreshToken` and `login` through 11.2 (C11). **This needs D3 and the portal endpoint**, so it belongs to AS-P0-SECURITY-009.
4. Leave `InstitutionSubscription` data in place, but stop every write to it and to `Institution.planTier` from billing code.

### 11.5 Institutional licences: current support and gaps

| Need | Current support |
|---|---|
| Product-specific institutional licence | **Partial.** An `Organization` `Subscription` per product exists |
| Who is covered | **Gap.** Any `Membership` (OWNER, ADMIN or MEMBER) is entitled; there is no eligibility rule |
| Seats or seat limits | **Missing.** No model exists. The product `SubscriptionPlan.maxUsers` exists, but it lives in the wrong system and is unenforced |
| Licence status and paid-through | Reuses `Subscription.status` and `currentPeriodEnd` |
| Institution membership verification in the product | **Missing.** There is no `Organization` ↔ `Institution` mapping, and SSO users have `institutionId = null` |
| Explicit trial grants | **Missing** (no `TrialGrant` record; `TRIALING` is denied) |

**Future models** (AS-P0-SECURITY-007 or later; **[DECISION D4]** on scope):

- `InstitutionLicence (organizationId, productId, status, seatLimit?, paidThrough, subscriptionId)`;
- `LicenceSeat (licenceId, userId, assignedAt, revokedAt)`;
- `TrialGrant (subjectType, subjectId, productId, grantedBy, startsAt, endsAt, reason)`;
- `OrganizationInstitutionLink (organizationId, product, productInstitutionId)`.

None of these exist today, and none was created.

---

## 12. Institutional licence gaps

See section 11.5. **Key fact [VERIFIED]:** no data path links a portal `Organization` to a product `Institution`. Institution-sponsored access therefore works only at launch time, and only per user. Products cannot attribute the user to the sponsoring institution.

---

## 13. Legacy billing transition plan **[RECOMMENDATION; nothing executed]**

### 13.1 Classification of product-side records

| Record type | Commercial or academic | Treatment |
|---|---|---|
| `institution_subscriptions`, `invoices`, `payments`, `coupons`, `coupon_redemptions`, `subscription_plans` | **Commercial** | Freeze writes, then preserve, inventory and map |
| `Institution` (name, departments, members, `institutionType`, `maxUsers`) | **Academic configuration** | Keep and keep using. Do not remove |
| `Institution.planTier`, `Institution.tenantStatus` | **Commercial, embedded in academic** | Keep the columns. Stop billing writes. Display the central entitlement instead |
| `usage_records`, `feature_flags` | Operational | Keep. Re-evaluate under the central plan model later |
| `api_keys` (product) | Operational | Keep |

### 13.2 Read-only production inventory queries (to run in AS-P0-SECURITY-010, against a read replica)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT s.status, (s."trialEndsAt" IS NOT NULL) has_trial, p.slug, p.price, p.currency,
       (s."externalSubId" IS NOT NULL) has_provider_sub,
       count(*) n,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM payments pm JOIN invoices i ON i.id = pm."invoiceId"
                                      WHERE i."subscriptionId" = s.id AND pm.status = 'SUCCEEDED')) with_payment
FROM institution_subscriptions s JOIN subscription_plans p ON p.id = s."planId"
GROUP BY 1,2,3,4,5,6 ORDER BY 1,3;
-- duplicate payments per reference (C5)
SELECT "paymentProvider", "transactionReference", count(*) FROM payments
WHERE "transactionReference" IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
-- invoices marked PAID with no succeeded payment, or underpaid
SELECT i.id, i.total, sum(pm.amount) FILTER (WHERE pm.status='SUCCEEDED') paid
FROM invoices i LEFT JOIN payments pm ON pm."invoiceId" = i.id
WHERE i.status = 'PAID' GROUP BY 1,2 HAVING coalesce(sum(pm.amount) FILTER (WHERE pm.status='SUCCEEDED'),0) < i.total;
```

### 13.3 Proposed mapping

| Legacy record | Source product | Target central record | Evidence available | Recommended action | Risk |
|---|---|---|---|---|---|
| `InstitutionSubscription` `ACTIVE` with a SUCCEEDED, amount-matched `Payment` and a provider reference | **Ambiguous** (shared table, no product column) | `Subscription` (organization) for **the product(s) [DECISION D5]** + `Invoice` + `EntitlementPeriod` | Provider re-fetch of `transactionReference` | **Manual review**. It can be mapped only after the product, the payer organization and the paid period are confirmed with the provider | Mis-attribution to the wrong product; granting a period that was never paid |
| `InstitutionSubscription` `ACTIVE` with **no** succeeded payment (created or upgraded through C1, C4) | Ambiguous | None | None | **Do not map.** Flag for review; leave the row untouched | High if mapped: free access |
| `InstitutionSubscription` `TRIALING` (automatic or client-set trial) | Ambiguous | `TrialGrant` only if the owner explicitly approves | None | **Do not map automatically** (approved policy: trials only through central authority) | Grants unapproved trials |
| `PAST_DUE`, `CANCELLED`, `EXPIRED`, `PAUSED` | Ambiguous | None | n/a | Preserve; do not map | Low |
| `Invoice` `PAID` and `Payment` `SUCCEEDED` | Ambiguous | `Invoice` (central) **only** as payment history if the provider confirms it | Provider API | Manual review | Duplicate payments (C5) inflate history |
| Duplicate `Payment` rows (same provider and reference) | Either | One central `Invoice` | Provider API | Deduplicate in the mapping, not in the source | Double credit |
| `Coupon`, `CouponRedemption` | Either | Portal `Coupon` only if still offered | n/a | Re-create intentionally; do not migrate redemptions as entitlement | Low |
| `user_product_roles` legacy ids (`lecturercraft`, `scholarcraft`) | Products | Canonical ids | Present locally, including 1 overlapping user | Run the conflict-aware correction from AS-P0-SECURITY-002 section F | Unique-constraint failure; role escalation if mistimed |

---

## 14. Provider-specific findings

### 14.1 Paystack currency [VERIFIED]

- **Where currency is defined:** `ProductPlan.currency`. There is one per product-plan, **shared by Stripe, Paystack and Flutterwave**. All seeded Academic Suite plans are **USD** (local DB, read-only, in AS-P0-SECURITY-005).
- **Provider-specific pricing:** none. `paystackPlanCode` and `flutterwavePlanId` exist but are unused, and Stripe has its own `stripePriceId`, which carries Stripe's own currency.
- **Effect of changing global plan currency to NGN:** it would make Stripe's price-currency check fail. The sync requires the item price currency to equal `ProductPlan.currency`, so every Stripe subscription would fall into review. It would also re-price Flutterwave.
- **Safe way to introduce NGN for Paystack [RECOMMENDATION, D6]:** an additive `ProductPlanPrice (productPlanId, provider, currency, amountMinor, isActive)` with `@@unique([productPlanId, provider, currency])`.
    - Checkout and amount verification read the provider-specific row.
    - They fall back to `ProductPlan` only if no row exists.
    - Stripe keeps `stripePriceId`.
- **Do not assume the merchant account supports USD.** **[MISSING EVIDENCE]**: not confirmed. With AS-P0-SECURITY-005's fix, an unsupported currency makes Paystack **refuse** the checkout rather than undercharge.

### 14.2 Stripe renewal (approved strict policy, unchanged) [VERIFIED behaviour]

- Stripe advances `items.data[].current_period_end` at renewal **before** the renewal invoice is paid.
- The sync extends only when the latest invoice is `paid`, so access lapses from the old period end until `invoice.paid` arrives. That is typically up to about an hour (Stripe's draft-to-finalise-to-charge delay). **[INFERENCE** about the duration; not sandbox-measured**]**
- No grace period is applied.

### 14.3 Refund and dispute events and verification

| Signal | Stripe | Paystack | Flutterwave |
|---|---|---|---|
| Refund attempted | `refund.created` (`pending`) | `refund.pending`, `refund.processing` | **Requires confirmation** (refunds are API-initiated; webhook coverage depends on account settings) |
| Refund succeeded | `refund.updated` / `charge.refunded` (`succeeded`) | `refund.processed` | Requires confirmation |
| Refund failed | `refund.failed` | `refund.failed` | Requires confirmation |
| Dispute opened | `charge.dispute.created` | `charge.dispute.create` | Chargeback notifications; requires confirmation |
| Dispute won or lost | `charge.dispute.closed` with `status` `won`/`lost` (also `funds_reinstated` / `funds_withdrawn`) | `charge.dispute.resolve` (resolution field) | Requires confirmation |
| Reversal | Treated as a refund or lost dispute | Requires confirmation | Requires confirmation |
| **Verification required before any entitlement change** | Signature (`constructEvent`), then re-fetch `GET /v1/refunds/:id` or `/v1/disputes/:id`, and check `charge`/`payment_intent` maps to a known `Invoice` | HMAC-SHA512 (timing-safe), then `GET /refund/:id` or `GET /dispute/:id`, and check `transaction.reference` maps to a known `Invoice` | `verif-hash`, then `GET /refunds/:id`, `GET /chargebacks?flw_ref=`, and check `tx_ref` maps to a known `Invoice` |

These event names come from the providers' published documentation as known to this review. None has been exercised in a sandbox. **[MISSING EVIDENCE]**

### 14.4 Product-side provider code (legacy) [VERIFIED]

- Comparisons use `!==` rather than timing-safe equality (Paystack, Flutterwave).
- Flutterwave: HMAC-SHA256 versus the header, which may not match Flutterwave's scheme. **Requires sandbox confirmation.**
- No amount verification and no idempotency (C5).
- **Recommendation:** freeze; do not invest in fixing (superseded by central billing).

---

## 15. Security and audit requirements (for AS-P0-SECURITY-007 to -009)

1. **Webhook signatures:** verified with timing-safe comparison before the body is parsed or trusted. **[Already true in the portal]**
2. **Provider re-fetch:** every refund, dispute and payment state is re-fetched from the provider API before any entitlement change. The webhook body is a trigger only.
3. **Idempotency:** R1, R2 and R3, plus `Invoice.providerInvoiceId`.
4. **Transactions:** one database transaction per event, with a subscription row lock.
5. **No entitlement change from:**
    - unverified events (`ProviderEvent.outcome = UNVERIFIED`);
    - frontend actions;
    - product-side billing routes.
6. **Audit content, for every change:** `EntitlementChange` plus `AuditLog`, with the actor or source (`provider:<name>`, `user:<id>`, `system`), before and after status and `currentPeriodEnd`, the provider event or adjustment id, a timestamp and a reason code.
7. **Fail closed when audit persistence fails** (the transaction aborts and the provider retries):
    - every entitlement **grant or extension** (existing: launch grant returns 503; billing extension rolls back);
    - every **revocation, suspension or restoration** from a refund or dispute, so a revocation is never applied unaudited;
    - manual admin overrides.

    An audit failure on a *denied launch* is logged and still denies (existing behaviour).
8. **Never log:** API keys, webhook secrets, access, refresh or launch tokens, `CRAFT_LAUNCH_SECRET`, card or bank details, full provider payloads. Store ids, amounts, currency and status only. **[Current portal code complies; verified in AS-P0-SECURITY-004 and -005 tests]**

---

## 16. Migration risks

| Risk | Mitigation |
|---|---|
| Legacy product subscriptions mapped to the wrong product (shared table) | Manual review with provider evidence; D5 |
| Free or self-granted legacy `ACTIVE` rows treated as paid | Map only rows with provider-confirmed, amount-matched payments |
| Locking product billing writes breaks admin UI flows | 006A returns explicit 403 or 410 with a message; the UI shows "managed in UAMSA Tech portal" |
| Making direct signup default-off locks out environments relying on the default | Set `DISABLE_DIRECT_SIGNUP` explicitly per environment before release |
| Adding refresh-time entitlement checks logs users out during portal outages | Bounded cache (11.3), monitoring, a status page |
| Backfill of `Invoice.productPlanId` and `interval` for old invoices | Leave null; the chain rebuild treats null-interval legacy invoices as **manual review** (same as AS-P0-SECURITY-005 `needs_review`) |
| Shared Prisma migration history across products (AS-P0-SECURITY-002) | Do not add product-side migrations in these phases; portal schema changes only |
| Portal `Invoice.providerInvoiceId` global uniqueness collides across providers | Low probability; D7 in AS-P0-SECURITY-007 |

---

## 17. Implementation sequencing

| Phase | Content | Why in this position |
|---|---|---|
| **AS-P0-SECURITY-006A — Product billing containment (new)** | No schema change. Lock product billing write routes (C1–C4); make `DISABLE_DIRECT_SIGNUP` fail closed (C10); point dashboard Quick Launch at `/api/portal/launch/[slug]` (C9); stop the duplicate cron. Touches LectureSuite billing files **adjacent to** the user's branding edits, so edits must be line-scoped (the edited lines themselves need no change) | It closes active, schema-independent defects first. It is the smallest change that stops product records acting as a self-service authority |
| **AS-P0-SECURITY-007 — Central billing schema and refund/dispute foundation** | Section 9 models plus the `Invoice` additions; migration **designed and reviewed**, applied only to dev and test; no backfill | A prerequisite for 008 |
| **AS-P0-SECURITY-008 — Central refund and dispute processing** | Verified refund and dispute webhooks for the three providers, the period ledger, chain rebuild, audit, tests | Depends on 007 |
| **AS-P0-SECURITY-009 — Product billing authority reconciliation** | Portal internal entitlement endpoint and service credential (D3); products check entitlement on login, SSO and refresh rotation (C11); remove the automatic trial path entirely; show central status in the product billing UI; keep academic institution features | Needs the 011-ready contract and 006A done |
| **AS-P0-SECURITY-010 — Legacy subscription migration preparation** | Read-only production inventory (13.2); explicit mapping (13.3); before and after proposals; approval gate | Needs 007's schema to have targets |
| **AS-P0-SECURITY-011 — Production billing readiness** | Sandboxes (3 providers), secret provisioning, Paystack currency (D6), backfills (AS-P0-SECURITY-004/005 and 010) under explicit approval, monitoring | Last |

**ResearchSuite preparation, with no changes made:** it should consume the same contract (11.1) and launch token rules (`aud`/`target` = `researchsuite`). It needs a `researchsuite` row in the portal `PRODUCT_MAP`, `CATALOG_SLUGS` and `Product`. It must **not** ship its own billing.

---

## 18. Outstanding decisions

| ID | Decision |
|---|---|
| D1 | During an open dispute, deny access inside the suspended period (proposed), or flag only? |
| D2 | On a lost dispute against a Stripe renewal, also cancel the Stripe subscription, or only revoke that period? |
| D3 | Entitlement transport: a server-to-server entitlement endpoint (proposed), or extended launch-token claims? |
| D4 | Scope of the institutional licence and seat model, and of the trial-grant model (AS-P0-SECURITY-007 or later) |
| D5 | Attribution rule for legacy `institution_subscriptions` rows that cannot be tied to one product |
| D6 | Paystack: enable USD on the merchant account, or introduce provider-specific NGN prices (`ProductPlanPrice`)? |
| D7 | Make `Invoice.providerInvoiceId` provider-scoped (`@@unique([provider, providerInvoiceId])`)? |
| D8 | Whether to retire the dormant cookie SSO (`/api/auth/me` CORS for `*.uamsatech.com`) or document it as unsupported |
| D9 | Approve the 006A containment phase and its user-visible effect: product billing pages become read-only |

---

## 19. Production-readiness blockers

1. Product billing self-service grants (C1–C4) and the indefinite product sessions (C11). Containment and the session fix are not done.
2. Direct product signup defaults to open (C10).
3. Refund and dispute handling: the schema (section 9) is not approved or built.
4. No sandbox validation for any provider (AS-P0-SECURITY-005 section 7).
5. No production read access, so neither the legacy product data nor the portal backfill evidence is known.
6. The Paystack currency decision (D6).
7. The role-identifier data correction (AS-P0-SECURITY-002 section F) is still unexecuted, and a conflicting row exists locally.
8. No institution identity federation (`Organization` ↔ `Institution`), needed for institution-sponsored access in products.

---

## 20. Final recommendation

**Do not deploy billing or entitlement changes to production yet.**

1. Next, run **AS-P0-SECURITY-006A (product billing containment)**. It is small, needs no schema change, and closes the self-service upgrade and trial path, the fail-open signup default and the dashboard bypass.
2. Then run **AS-P0-SECURITY-007** using the additive schema in section 9, after decisions D1, D3, D4 and D7.
3. Folding the session-lifetime fix (C11) into AS-P0-SECURITY-009 depends on D3.
4. No production write, migration or backfill should be approved until AS-P0-SECURITY-010 produces provider-verified evidence.

---

## 21. Validation and final working-tree verification

### 21.1 Commands executed (all non-destructive)

| Repository | Command | Result |
|---|---|---|
| `uamsatech` | `vitest run --config vitest.config.ts` (with a distinct `CRAFT_LAUNCH_SECRET` in the process env; the local `.env` has the launch secret equal to `AUTH_JWT_SECRET`, a known configuration fault) | **PASS**: 10 files, 202 tests |
| `uamsatech` | `tsc --noEmit` | **PASS** |
| `uamsatech` | `eslint lib/billing app/api/billing lib/portal app/api/portal/launch/[product]/route.ts tests/unit` | **PASS** (0 problems) |
| `LectureCraft/backend` | `jest --runInBand` | **PASS**: 6 suites, 96 tests |
| `LectureCraft/backend` | `tsc --noEmit`; `tsc --noEmit -p tsconfig.test.json` | **PASS**; **PASS** |
| `ScholarCraft/backend` | `jest --runInBand` | **PASS**: 5 suites, 67 tests |
| `ScholarCraft/backend` | `tsc --noEmit`; `tsc --noEmit -p tsconfig.test.json` | **PASS**; **PASS** |
| All three | `prisma validate` (dummy unreachable `DATABASE_URL`) | **PASS** (3 valid schemas) |
| Local `craftsuite` | Read-only inventory scripts (loopback and read-only verified) | Executed; results in sections 1, 6 and 13 |
| — | `next build`, product builds | **NOT RUN**. No code changed in this phase; last passing builds were in AS-P0-SECURITY-005 (portal) and -002 (products) |
| — | Provider sandboxes | **NOT RUN** (no credentials) |
| — | Production database | **NOT CONNECTED** (no production access; not attempted) |

### 21.2 Final working-tree verification

**[VERIFIED after the report was written]:**

- HEAD, branch, staged count (0) and stashes (0) are unchanged in all three repositories.
- Every file in the start manifests (24 + 129 + 30) has an **identical SHA-256** at the end.
- The three protected LectureSuite files are unchanged.
- The only new file is this report, `uamsatech/docs/AS-P0-SECURITY-006-CENTRAL-BILLING-ARCHITECTURE-REPORT.md`, which is untracked.
- No production data was changed, no migration was executed, nothing was deployed, and nothing was committed or pushed.
