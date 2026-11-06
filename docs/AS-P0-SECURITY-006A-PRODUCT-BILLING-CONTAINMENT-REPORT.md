# AS-P0-SECURITY-006A — Product Billing Containment and Entitlement Bypass Closure

**Date:** 4 November 2026
**Repositories:** UAMSA Tech portal (`uamsatech/`), LectureSuite (`LectureCraft/`), ScholarSuite (`ScholarCraft/`)
**Predecessor:** `docs/AS-P0-SECURITY-006-CENTRAL-BILLING-ARCHITECTURE-REPORT.md`

**Status labels:**

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Code changed |
| **TESTED** | Executed tests prove it |
| **NOT IMPLEMENTED** | Not built in this phase |
| **DEFERRED** | Belongs to a later phase |
| **BLOCKED** | Cannot proceed without something missing |
| **REQUIRES APPROVAL** | Needs an owner decision |

**Recommendation for AS-P0-SECURITY-007: GO** (section 21).

---

## 1. Executive summary

Every identified product-side bypass is closed in code and covered by executed tests.

| # | Finding (AS-P0-SECURITY-006) | Result |
|---|---|---|
| 1–4 | Ordinary members could create (with a client-chosen `trialDays`), upgrade, cancel or resume the institution's subscription without payment, and start checkout | **IMPLEMENTED + TESTED.** The routes return 410 `BILLING_MANAGED_CENTRALLY`, and the service methods refuse independently |
| 5 | Billing middleware existed but was unattached, and `requireActiveSubscription` treated legacy records as proof | **IMPLEMENTED + TESTED.** It now delegates to the central decision. The plan-limit helpers are documented as not-an-access-gate |
| 6 | Direct signup open by default | **IMPLEMENTED + TESTED.** Disabled when the variable is unset. Only `'true'` or `'false'` are accepted |
| 7 | `/login` issued sessions without entitlement | **IMPLEMENTED + TESTED.** Central verification runs before any token |
| 8 | Refresh issued a new 7-day token indefinitely | **IMPLEMENTED + TESTED.** Re-verified on every rotation. A denial ends the session, and the new token is capped at the paid-through date |
| — | `register` also issued sessions (found in this phase) | **IMPLEMENTED + TESTED.** Entitlement is verified before any account is created |
| 9 | Dashboard Quick Launch linked directly to products | **IMPLEMENTED + TESTED.** It goes through `/api/portal/launch/[product]`. Also fixed: the products page sent `uamsa` to the launch route, which returned 400 |
| 10 | Duplicate `expire-trials` cron | **IMPLEMENTED + TESTED.** No longer scheduled, a stored schedule is removed, and the handler refuses it |
| 11 | Duplicated billing, shared tables | **Contained, not merged.** Both copies are changed identically; legacy data is untouched (**DEFERRED** to AS-P0-SECURITY-009 and -010) |

The portal provides a new authenticated, server-to-server endpoint, **`POST /api/internal/entitlements/verify`**. It reuses the same `resolveProductEntitlement` decision as the SSO launch route, so there is no second policy.

**Validation:**

| Repository | Before | After |
|---|---|---|
| Portal | 202 tests | **242 pass** (40 new) |
| LectureSuite | 96 tests | **170 pass** (74 new) |
| ScholarSuite | 67 tests | **141 pass** (74 new) |

- Typecheck (application and test code) passes in all three.
- Portal lint is clean. The product backends have no lint configuration, so lint is **not applicable** there and was not claimed.
- All three builds pass.
- **11 of 11 mutation checks were caught** (section 15).

No schema change, migration, database write, deployment, commit or push occurred.

---

## 2. Starting repository and working-tree state

| Repository | Branch | HEAD (start = end) | Staged | Unstaged | Untracked | Stashes | Worktrees |
|---|---|---|---|---|---|---|---|
| `uamsatech/` | `master` | `abd27e51b111519764af8e0416f6d814abc770ef` | 0 | 11 | 14 | 0 | 1 |
| `LectureCraft/` | `main` | `c821e6ca7f7de04cade0b00f7ad1e9784e13c906` | 0 | 121 | 8 | 0 | 1 |
| `ScholarCraft/` | `master` | `642513423dd91aface44b05986b70082b0666964` | 0 | 32 | 3 | 0 | 1 |

**Before any change:**

- Start SHA-256 manifests were recorded: portal 25 files, LectureSuite 129, ScholarSuite 30.
- Compared with the AS-P0-SECURITY-006 manifests, there were **0 mismatches**. The only new file since then was the 006 report.

**Protected LectureSuite files (user edits). All are unchanged at the end:**

| File | SHA-256 (prefix) |
|---|---|
| `backend/src/services/billing/invoice.service.ts` | `f501986c0f3dbf61` |
| `backend/src/services/billing/providers/stripe.provider.ts` | `72350add0889698b` |
| `backend/src/services/billing/providers/flutterwave.provider.ts` | `e271e83363dce737` |

No change required touching them.

**Pre-existing deletions, which cannot be hash-verified:** in ScholarSuite, `frontend/__check_session.mjs`, `__phase1_audit.mjs`, `__phase1_console.mjs`, `__phase1_login_once.mjs` and `__phase1_trace.mjs` were already deleted (`D`) before AS-P0-SECURITY-006. They are still deleted. They are **not** changes made by this phase.

---

## 3. Findings independently reconfirmed (current code, not the previous report)

| Finding | Confirmed at | Difference from the 006 report |
|---|---|---|
| Billing write routes protected by `authenticate` only | `backend/src/routes/billing.routes.ts`, both products | None |
| `upgradeSubscription` sets `ACTIVE` and `planTier` before payment; `createSubscription` takes a client `trialDays`; `resumeSubscription` goes `CANCELLED → ACTIVE` | `services/billing/subscription.service.ts`, both | None |
| Billing middleware unattached; `requireActiveSubscription` allows when the record is missing, `TRIALING` or `PAST_DUE` | `middleware/billing/usage-limit.middleware.ts` | None |
| `DISABLE_DIRECT_SIGNUP: z.coerce.boolean().default(false)` | `config/env.ts`, both | **Additional detail:** `z.coerce.boolean()` also turned the string `"false"` into `true` |
| `login` issues tokens with no entitlement check | `services/auth/auth.service.ts` `login` | None |
| `rotateRefreshToken` issues a new 7-day token with no checks | `services/auth/jwt.service.ts` | **Additional:** it also skipped the account-status check (`SUSPENDED`, `INACTIVE`) |
| — | `services/auth/auth.service.ts` `register` | **New:** `register` issues a session directly. It also accepts a client-supplied `role` (up to `ADMINISTRATOR`) and `institutionId`. Both stay out of reach while signup is disabled (section 19) |
| Quick Launch direct link | `app/portal/dashboard/page.tsx` | **Refined:** Academic Suite products are `isLive: false` in `lib/site-config.ts`, so this bypass was **latent**. Only `uamsa` (the ERP, out of scope) linked out directly. **Also found:** `app/portal/products/page.tsx` sent `uamsa` to the launch route, which returned 400 |
| Duplicate cron | `workers/billing.worker.ts`, both, byte-identical: `expire-trials` (daily 02:00, writes `TRIALING→PAST_DUE`) and `aggregate-usage` (hourly, operational) | **Detail:** `renew-subscription` had no producer. `generate-invoice` had no producer |
| Duplicate billing implementations | Byte-identical except the 4 protected branding lines | None |

---

## 4. Files changed

### Portal (`uamsatech/`)

| File | Change | Status |
|---|---|---|
| `app/api/internal/entitlements/verify/route.ts` | **New:** the central verification endpoint | IMPLEMENTED |
| `lib/portal/entitlement-service.ts` | **New:** `authenticateProductService` and `decideEntitlementForEmail` | IMPLEMENTED |
| `lib/portal/launch-links.ts` | **New:** `ENTITLEMENT_LAUNCH_SLUGS` and `productLaunchHref` | IMPLEMENTED |
| `lib/env.ts` | `LECTURESUITE_ENTITLEMENT_SERVICE_SECRET` and `SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET` (optional, at least 32 characters, distinct) | IMPLEMENTED |
| `app/portal/dashboard/page.tsx` | Quick Launch `href` now uses `productLaunchHref(product)` | IMPLEMENTED |
| `app/portal/products/page.tsx` | Launch `href` now uses `productLaunchHref(product)` | IMPLEMENTED |
| `.env.example` | Documents the two service secrets (placeholders fail validation) | IMPLEMENTED |
| `tests/unit/internal-entitlements.test.ts`, `tests/unit/launch-links.test.ts` | **New** tests | TESTED |

`lib/portal/entitlement.ts` (the policy), the launch route and `audit.ts` are **unchanged**.

### LectureSuite and ScholarSuite (`backend/`), the same change in both

| File | Change |
|---|---|
| `src/config/product.ts` | **New:** `PRODUCT_ID` (`lecturesuite` or `scholarsuite`) |
| `src/services/auth/central-entitlement.ts` | **New:** `verifyCentralEntitlement` and `requireCentralEntitlement` (identical in both) |
| `src/services/billing/central-billing.ts` | **New:** `centralBillingOnly`, `assertProductBillingWritesDisabled` and `billingManagedCentrally` |
| `src/config/env.ts` | `DISABLE_DIRECT_SIGNUP` strict, defaulting to disabled. `CENTRAL_ENTITLEMENT_URL`, `CENTRAL_ENTITLEMENT_SERVICE_SECRET` and `CENTRAL_ENTITLEMENT_TIMEOUT_MS`. Distinctness and production-HTTPS rules |
| `src/services/auth/auth.service.ts` | `login` and `register` are gated. The refresh token is capped at the paid-through date |
| `src/services/auth/jwt.service.ts` | `createRefreshToken(userId, notAfter?)`. `rotateRefreshToken` re-verifies status and entitlement |
| `src/routes/auth.routes.ts` | Signup refusal: code `DIRECT_SIGNUP_DISABLED`, portal message |
| `src/routes/billing.routes.ts` | Five write routes now return `centralBillingOnly` |
| `src/services/billing/subscription.service.ts` | Six method guards |
| `src/services/billing/payment.service.ts` | `initiatePayment` is guarded. The webhook no longer changes subscription status |
| `src/middleware/billing/usage-limit.middleware.ts` | `requireActiveSubscription` is central. The plan-limit helpers carry a warning |
| `src/workers/billing.worker.ts` | `expire-trials` is unscheduled, its stored schedule is removed, and the commercial jobs are refused |
| `.env.example` | Signup default and central entitlement variables documented |
| `src/__tests__/containment.test.ts`, `src/__tests__/billing-cron.test.ts` | **New** tests (identical apart from the product-constants block) |
| `src/__tests__/security.test.ts`, `sso-security.test.ts`, `env-schema.test.ts` | Environment setup only: the two new required variables. No assertion was changed |

**How the shared files were mirrored:** the five byte-identical billing files were edited in ScholarSuite and copied to LectureSuite. Each copy happened only after verifying that the LectureSuite file was unmodified in git and matched ScholarSuite's committed version. Line endings (CRLF) were preserved.

---

## 5. Product billing routes contained (IMPLEMENTED + TESTED)

**Routes:**

| Route (both products) | Before | After |
|---|---|---|
| `POST /api/billing/subscription` | Creates `ACTIVE` or `TRIALING` (with any `trialDays`) | **410** `BILLING_MANAGED_CENTRALLY` |
| `PATCH /api/billing/subscription/upgrade` | `ACTIVE`, new period, `planTier` synced, unpaid invoice | **410** |
| `PATCH /api/billing/subscription/cancel` | Local cancellation | **410** |
| `PATCH /api/billing/subscription/resume` | `CANCELLED/PAUSED → ACTIVE`, no payment | **410** |
| `POST /api/billing/payments/initiate` | Local checkout | **410** |
| `GET /api/billing/subscription`, `/invoices`, `/payments`, `/usage` | Read | **Unchanged** (read-only history preserved) |
| `POST /api/billing/webhooks/{stripe,paystack,flutterwave}` | Records payment, marks invoice paid, **flips `PAST_DUE → ACTIVE`** | Still records payment and invoice history. **No subscription status change** |
| Admin routes (`requireRole('SUPER_ADMIN','ADMIN')`): coupons, feature flags, invoice void, statistics | Admin-only | Unchanged; they grant no access (section 19) |

**Response for disabled operations:** `410 { "message": "Subscriptions and payments are managed in the UAMSA Tech portal. This action is not available in the product.", "code": "BILLING_MANAGED_CENTRALLY" }`. There are no internals in the body, and a test asserts the absence of `prisma`, `stack` and `secret`.

**Defense in depth:** `subscriptionService.createSubscription`, `upgradeSubscription`, `cancelSubscription`, `resumeSubscription`, `renewSubscription`, `processExpiredTrials` and `paymentService.initiatePayment` all throw that same 410 **before touching any record**, so no future caller (route, worker or script) can use them. No model, record or field was deleted.

**Tests** (`containment.test.ts` › "product billing write routes — contained"):

- *"a STUDENT / LECTURER / ADMIN cannot create, upgrade, cancel, resume or start checkout (410)"* (3 cases).
- *"unauthenticated write attempts are still 401"*.
- *"read-only subscription history remains available"*.
- *"service guard: … is refused (410) without touching any record"* (7 cases).
- *"a legacy provider webhook still records payment history but no longer marks the subscription ACTIVE"*.

---

## 6. Trial bypasses closed (IMPLEMENTED + TESTED)

- **Client trial length:** `trialDays` from the client is no longer accepted anywhere. The only path, `createSubscription`, is refused at both route and service level. Test: *"service guard: createSubscription with an arbitrary trialDays"*; the route test posts `trialDays: 100000`.
- **No product-side trial creation:** the automatic 14-day default lived inside `createSubscription` and is unreachable. Registration and onboarding never created trials (verified; the only caller was the route).
- **Historical records untouched:** `expire-trials` (`TRIALING → PAST_DUE`) no longer runs (section 13). Trial fields and enum values are kept.
- **`TRIALING` grants nothing:** product access now requires central entitlement, and the central policy denies `TRIALING` without an explicit central grant (portal test *"DENIED for TRIALING (no explicit central trial grant)"*).
- **`Institution.tenantStatus`** still defaults to `TRIAL` in the schema (no schema change allowed). It is display-only and gates nothing (**NOT IMPLEMENTED**; schema).

---

## 7. Direct signup configuration (IMPLEMENTED + TESTED)

```ts
DISABLE_DIRECT_SIGNUP: z.enum(['true', 'false']).default('true').transform((v) => v === 'true')
```

| Value | Result |
|---|---|
| unset | **disabled** |
| `'true'` | disabled |
| `'false'` | enabled, but registration still needs central entitlement (below) |
| anything else (`'1'`, `'0'`, `'yes'`, `'False'`, `'TRUE'`, `''`) | **startup fails** |

The semantics were checked before editing: the flag means "disable", and the route middleware `ssoOnly` blocks when it is `true`. Nothing is inverted.

**Enforcement is in the backend** (`routes/auth.routes.ts` `ssoOnly`), in front of `/register` and `/register-institution`:

```json
403 { "status": "error", "code": "DIRECT_SIGNUP_DISABLED",
      "message": "Registration is managed through the UAMSA Tech portal. Please sign up at uamsatech.com." }
```

**When enabled (`'false'`):** `authService.register` calls `requireCentralEntitlement` **before** creating the account, so no un-entitled account or session can be created. `register-institution` issues no session; the user must then log in, which is gated.

Existing accounts are not touched.

**Tests** (`containment.test.ts` › "direct signup — disabled by default, backend-enforced"):

- missing gives disabled;
- `'true'` and `'false'`;
- 6 ambiguous values are rejected;
- HTTP `/register` and `/register-institution` are refused with the flag unset or `'true'`, and `user.create` is never called;
- with `'false'`, registration without entitlement returns 403 and creates no account;
- with `'false'`, registration with entitlement proceeds.

---

## 8. Login entitlement verification (IMPLEMENTED + TESTED)

**Order in `authService.login`:**

1. Find the user.
2. Lockout check.
3. Password check.
4. Account status check.
5. **`requireCentralEntitlement(PRODUCT_ID, user.email)`**.
6. Only then: the product-role upsert, tokens, the refresh token capped at `paidThrough`, and the login session.

Neither the product account nor any legacy billing record is consulted for entitlement.

**Responses:**

| Case | Response |
|---|---|
| Absent | `403 ENTITLEMENT_REQUIRED` |
| Expired | `403 ENTITLEMENT_EXPIRED` |
| Suspended | `403 ENTITLEMENT_SUSPENDED` |
| Revoked | `403 ENTITLEMENT_REVOKED` |
| No decision (outage, bad credential, malformed reply) | `503 ENTITLEMENT_UNAVAILABLE` |

The message is generic and discloses no subscription details.

**Tests** (`containment.test.ts` › "login — central entitlement required before any session"):

- valid credentials without entitlement get no tokens, no role upsert and no refresh token;
- valid credentials with entitlement receive tokens;
- expired, suspended and revoked entitlements are denied;
- a central outage does not grant access;
- invalid service authentication does not grant access;
- a legacy `ACTIVE` subscription does not substitute for entitlement;
- a wrong password returns 401 and the portal is not consulted, so no entitlement oracle exists for bad credentials;
- a suspended account is refused without consulting the portal;
- the refresh token issued at login never outlives the paid-through date.

---

## 9. Refresh entitlement verification (IMPLEMENTED + TESTED)

**`rotateRefreshToken`:**

1. Validate the presented token (it must exist and be unexpired).
2. **Account status check:** `SUSPENDED` or `INACTIVE` deletes the token and returns 403.
3. **`requireCentralEntitlement`:**
    - **403** (a definitive denial): the presented token is **deleted**, so the session ends and that token cannot be retried.
    - **503** (no decision): the token is **kept**, so the user can retry once the portal is reachable, but **nothing is issued**.
4. Only after a grant: delete the old token, then issue a new access token and a refresh token with `expiresAt = min(now + JWT_REFRESH_EXPIRES_IN, paidThrough)`.

Refresh activity can never extend access past the verified paid-through date.

**Tests** (`containment.test.ts` › "refresh rotation — re-verified every time"):

- valid entitlement rotates;
- expired, revoked, suspended and absent entitlements cannot rotate, the session is ended, and **re-presenting the same token fails**;
- a central outage cannot produce a new token, and the old token is kept;
- invalid service authentication cannot produce a token;
- *"refresh activity does not extend access: the new token expires at the paid-through date, not 7 days out"*;
- a suspended account cannot rotate.

**SSO path:** `GET /api/auth/sso` is unchanged. It accepts only a portal launch token, which the portal signs only after the same entitlement decision. The first refresh, at most 15 minutes later when the access token expires, is centrally verified.

---

## 10. Central entitlement API contract (IMPLEMENTED + TESTED)

**Endpoint:** `POST {portal}/api/internal/entitlements/verify`

**Request:**

```http
Authorization: Bearer <this product's entitlement service secret>
Content-Type: application/json

{ "product": "lecturesuite" | "scholarsuite", "subject": { "email": "user@example.edu" } }
```

**Response 200 (`CentralEntitlementDecision`):**

```json
{ "v": 1, "product": "lecturesuite", "decision": "GRANTED", "status": "ACTIVE",
  "reason": null, "paidThrough": "2026-12-01T00:00:00.000Z", "decidedAt": "2026-11-04T12:00:00.000Z" }
```

**Field meanings:**

- **`decision`:** `GRANTED` or `DENIED`.
- **`status`:** one of the following.
    - `ACTIVE` (granted).
    - `NONE` (no subscription, no account, or an ambiguous account).
    - `EXPIRED`.
    - `DENIED` (trial not centrally authorised, past due, canceled, unknown paid-through, other status).
    - `SUSPENDED` and `REVOKED`. These are **reserved** for AS-P0-SECURITY-008 and are never produced yet, but products already treat them as deny.
- **`reason`:** the policy's reason code (`no_subscription`, `expired`, `period_end_unknown`, `trial_not_authorized`, `past_due`, `canceled`, `status_not_entitled`, `no_account`, `ambiguous_account`).

**Policy:** exactly `resolveProductEntitlement` (AS-P0-SECURITY-002/004), the same function the SSO launch route uses:

- an active subscription with a future paid-through date grants;
- `TRIALING`, `PAST_DUE`, `CANCELED`, an unknown or expired period, and any other status deny;
- the check is product-specific.

A subscription row by itself never grants.

**Identity:** the email is matched case-insensitively. No match, or more than one, is denied, not guessed.

**Non-200 responses mean "no decision", and products deny:**

| Status | Body | Cause |
|---|---|---|
| 400 | `malformed_request` or `unknown_product` | Bad body or unknown product |
| 401 | `unauthorized` | Bad or missing credential |
| 429 | `rate_limited` | 600 per minute per IP before authentication; 1,200 per minute per product after |
| 503 | `not_configured` or `unavailable` | Credential not configured, or the decision failed |

All responses carry `Cache-Control: no-store`.

**Product-side failure behaviour** (`verifyCentralEntitlement`, **no cache**):

| Situation | Result |
|---|---|
| `GRANTED` + `ACTIVE` + future `paidThrough` + matching `product` | Allow |
| Explicit denial | 403 (`denied`, `expired`, `suspended`, `revoked`) |
| `GRANTED` with past `paidThrough` | 403 `expired` |
| Network error or timeout (`CENTRAL_ENTITLEMENT_TIMEOUT_MS`, default 5 s) | 503 `unavailable` |
| HTTP 5xx or 429 | 503 `unavailable` |
| HTTP 400 or 401 (bad credential) | 503 `misconfigured`, logged as an error |
| Non-JSON, wrong shape, `GRANTED` without `ACTIVE` or `paidThrough`, product mismatch | 503 `malformed` |

**Redirects** are refused (`redirect: 'error'`), so the credential is never forwarded.

**Caching:** none. Each login, registration and refresh makes one portal call. A revocation or expiry takes effect at the next refresh, at most 15 minutes away (the access-token lifetime).

**Tests:**

- Portal (`internal-entitlements.test.ts`, 30 tests):
    - GRANTED with paid-through;
    - case-insensitive email;
    - 5 denial statuses;
    - product-specific;
    - an account alone is denied;
    - no account;
    - ambiguous account;
    - institution membership;
    - decision failure returns 503.
- Product (`containment.test.ts` › "central entitlement client", 20 tests): every row of the table above.

---

## 11. Service-to-service authentication design (IMPLEMENTED + TESTED)

**One credential per product:**

- The portal holds `LECTURESUITE_ENTITLEMENT_SERVICE_SECRET` and `SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET`.
- Each product holds only its own, as `CENTRAL_ENTITLEMENT_SERVICE_SECRET`.

**Rules:**

- **Product binding.** The portal compares the bearer value with the secret configured **for the product named in the request**. LectureSuite's credential therefore cannot obtain ScholarSuite decisions (test: *"binds a credential to ONE product"*; mutation M10).
- **Timing-safe comparison.** SHA-256 digests are compared with `timingSafeEqual`, so length does not leak.
- **Header only.** The credential travels in the `Authorization` header, never in the URL (test asserts the URL does not contain the secret). It is server-to-server and never sent to the browser.
- **Not reused.**
    - The portal rejects a service secret equal to `CRAFT_LAUNCH_SECRET` or `AUTH_JWT_SECRET`, or equal to the other product's secret.
    - Each product rejects a service secret equal to `CRAFT_LAUNCH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` or `COOKIE_SECRET`.
- **HTTPS in production.** A product refuses to start with a non-HTTPS `CENTRAL_ENTITLEMENT_URL` when `NODE_ENV=production`.
- **Fail closed when unconfigured.**
    - Portal: an unset product secret returns 503 for that product.
    - Product: both variables are **required at startup**.
- **Logging.** Logs contain the product, decision, reason and HTTP status only. They never contain the credential or the email (tests assert both).

---

## 12. Quick Launch corrections (IMPLEMENTED + TESTED)

**`lib/portal/launch-links.ts` `productLaunchHref`:**

- Every Academic Suite slug (`lecturercraft`, `lecturesuite`, `scholarcraft`, `scholarsuite`) resolves to `/api/portal/launch/<slug>`, a **same-origin relative path**, so no open redirect is possible.
- The launch route then performs the product-specific entitlement check before signing a token.
- Products outside central entitlement keep their direct link. Today that is only the UAMSA ERP, which is out of scope and has its own access control.

**Used by:**

- `app/portal/dashboard/page.tsx` (Quick Launch tiles). The layout and cards are unchanged; only `href` changed.
- `app/portal/products/page.tsx` (the Launch button). This also fixes the `uamsa` 400.

**Other locations checked:**

- `app/(marketing)/products/[slug]/page.tsx`: structured-data `url` and a display label. Public marketing, **not changed**.
- `app/(marketing)/status/page.tsx`: display only, not changed.

**Tests** (`launch-links.test.ts`, 10 tests):

- each Academic Suite slug launches through the route;
- relative paths only;
- every catalog Academic Suite product is covered;
- UAMSA keeps its link;
- **the allowlist matches the launch route's `PRODUCT_MAP` exactly**;
- the dashboard and products page use the helper, with no raw subdomain link.

Invalid products are rejected by the existing launch route (existing `launch.test.ts`).

---

## 13. Duplicate cron treatment (IMPLEMENTED + TESTED)

**Responsibilities established first** (`workers/billing.worker.ts`, byte-identical in both products):

| Job | Schedule | Side effect | Treatment |
|---|---|---|---|
| `expire-trials` | Daily `0 2 * * *`, registered by **both** products against the shared `craftsuite` database | Writes `TRIALING → PAST_DUE` | **Unscheduled.** `removeRepeatable('expire-trials', { pattern: '0 2 * * *' })` clears a stored schedule (best effort). The handler refuses it |
| `renew-subscription` | Never enqueued | Rolls the period forward without payment | Handler **refuses** it |
| `generate-invoice` | Never enqueued | Creates invoices | Unchanged (dead; no producer) |
| `aggregate-usage` | Hourly | Update-or-create of `usage_records` (operational metering) | **Kept** |
| `collaboration.worker.ts` (reminders, digests, analytics) | — | Academic | **Untouched** |

**Tests** (`billing-cron.test.ts`, 6 tests):

- `expire-trials` is not scheduled;
- a stored schedule is removed;
- `expire-trials` and `renew-subscription` jobs are refused without touching records;
- `aggregate-usage` is still scheduled;
- the collaboration worker still registers its 3 schedules.

---

## 14. Environment variables introduced or changed

| Application | Variable | Required | Notes |
|---|---|---|---|
| Portal | `LECTURESUITE_ENTITLEMENT_SERVICE_SECRET` | Optional (unset means LectureSuite is refused with 503) | At least 32 characters; distinct from the launch, session and other product secrets |
| Portal | `SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET` | Optional (likewise) | Same rules |
| LectureSuite, ScholarSuite | `CENTRAL_ENTITLEMENT_URL` | **Required** | The full endpoint URL; HTTPS in production |
| LectureSuite, ScholarSuite | `CENTRAL_ENTITLEMENT_SERVICE_SECRET` | **Required** | Equals the portal's secret for this product; at least 32 characters; distinct |
| LectureSuite, ScholarSuite | `CENTRAL_ENTITLEMENT_TIMEOUT_MS` | Optional | 500 to 15,000; default 5,000 |
| LectureSuite, ScholarSuite | `DISABLE_DIRECT_SIGNUP` | Optional | **Default changed to disabled.** Only `true` or `false` |

**Documented in:** `uamsatech/.env.example` and both `backend/.env.example` files. The placeholders `<generate-a-new-secret>` are deliberately shorter than 32 characters, so they **fail** validation if copied.

**Not edited:**

- No local `.env` file was edited.
- No real secret was written.
- **The `docker-compose.prod.yml` files were not edited.** They are deployment configuration, and LectureSuite's carries user edits. Section 20 lists the exact lines they need.

---

## 15. Tests executed and results

| Repository | Command | Result |
|---|---|---|
| Portal | `vitest run --config vitest.config.ts` (distinct `CRAFT_LAUNCH_SECRET` in the process env; the local `.env` has the launch secret equal to `AUTH_JWT_SECRET`, a known configuration fault) | **PASS**: 12 files, **242 tests** (40 new: 30 `internal-entitlements`, 10 `launch-links`) |
| LectureSuite | `jest --runInBand` | **PASS**: 8 suites, **170 tests** (74 new: 68 `containment`, 6 `billing-cron`) |
| ScholarSuite | `jest --runInBand` | **PASS**: 7 suites, **141 tests** (74 new) |

No test was skipped. No pre-existing assertion was changed; only the environment setup in 3 existing test files gained the two required variables.

**Mutation checks** (each protection removed, the suite run, the code restored and verified with 0 markers):

| # | Mutation | Result |
|---|---|---|
| M1 | Login gate removed | Caught: 8 failures |
| M2 | Refresh gate removed | Caught: 7 |
| M3 | Refresh-expiry cap removed | Caught: 2 |
| M4 | Signup default reverted to open | Caught: 2 |
| M5 | `createSubscription` guard removed | Caught: 1 |
| M6 | Upgrade route reopened | Caught: 3 |
| M7 | `expire-trials` re-scheduled | Caught: 2 |
| M8 | Client trusts a past paid-through | Caught: 1 |
| M9 | Client ignores a product mismatch | Caught: 1 |
| M10 | Portal: credential not bound to product | Caught: 1 |
| M11 | Portal: direct subdomain links restored | Caught: 5 |

Mutations M1–M9 ran on ScholarSuite. The LectureSuite code is identical, apart from `PRODUCT_ID` and the environment schema context, and passes the same 74 tests.

## 16. TypeScript results

| Repository | Command | Result |
|---|---|---|
| Portal | `tsc --noEmit` | **PASS** |
| LectureSuite | `tsc --noEmit`; `tsc --noEmit -p tsconfig.test.json` | **PASS**; **PASS** |
| ScholarSuite | `tsc --noEmit`; `tsc --noEmit -p tsconfig.test.json` | **PASS**; **PASS** |

## 17. Lint results

| Repository | Result |
|---|---|
| Portal | `eslint lib/portal lib/billing app/api/internal app/api/portal/launch/[product]/route.ts app/portal/dashboard/page.tsx app/portal/products/page.tsx lib/env.ts tests/unit`: **PASS** (0 problems) |
| LectureSuite, ScholarSuite backends | **NOT APPLICABLE.** No lint script or ESLint configuration exists |

## 18. Build results

| Repository | Command | Result |
|---|---|---|
| Portal | `next build` | **PASS** (exit 0) |
| LectureSuite | `npm run build` (`tsc && tsc-alias`) | **PASS** |
| ScholarSuite | `npm run build` | **PASS** |

---

## 19. Remaining limitations

1. **Institution eligibility = membership** (**REQUIRES APPROVAL**, D4 from AS-P0-SECURITY-006).
    - The endpoint reuses the approved launch policy: a product-specific organization subscription plus `Membership` of any role.
    - It is product-specific, but there is no seat or eligibility rule beyond membership, because no licence or seat model exists. None was invented.
    - Restricting this needs the licence model (AS-P0-SECURITY-007 or later).
2. **Product operators.** Product `SUPER_ADMIN` and `ADMIN` users also need central entitlement to log in, and no bypass was added (**REQUIRES APPROVAL**). An operator-access mechanism must be decided centrally.
3. **Existing sessions.**
    - Refresh tokens issued before deployment are honoured only until their next rotation, which is now checked.
    - Access tokens live up to 15 minutes.
    - No sessions are mass-invalidated.
4. **Identity by email.**
    - Products identify users by email. A product account whose email differs from its portal account is denied.
    - SSO-provisioned accounts use the portal's email, so they match.
5. **No cache.** A portal outage blocks new logins and refreshes (503), and access tokens continue for at most 15 minutes. That is fail-closed by design. Monitoring is needed (section 20).
6. **Pre-existing issues, left out of scope:**
    - **Client-controlled registration.** When signup is enabled, `register` accepts a client-chosen `role` (up to `ADMINISTRATOR`) and `institutionId`. Disabling signup by default and gating on entitlement contain it, but it must be fixed before signup is ever enabled.
    - **Invalid refresh token returns 500.** `rotateRefreshToken` throws a plain `Error` for an invalid or expired token, which reaches the client as 500 rather than 401.
    - **Inconsistent role on refresh.** The refresh payload uses the global `user.role`, whereas login uses the product role.
7. **Legacy helpers.** `requireFeature` and `requireUsageCapacity` still read legacy plan data. They stay unattached and are documented as non-entitlement.
8. **Legacy webhooks** still record payment and invoice history (non-idempotent, as documented in AS-P0-SECURITY-006 C5), but no longer change status. The admin commercial-configuration routes (coupons, feature flags, invoice void) remain admin-only and grant no access.
9. **Duplicate usage aggregation.** `aggregate-usage` still runs in both products. BullMQ de-duplicates the repeatable job only if both products share one Redis. It is operational and was left as is.
10. **Frontends.** The product frontends still show sign-up forms and need user-facing messages for `DIRECT_SIGNUP_DISABLED`, `ENTITLEMENT_*` and `BILLING_MANAGED_CENTRALLY` (**NOT IMPLEMENTED**; backend enforcement is complete).
11. **The dormant cookie SSO** (`/api/auth/me` with `*.uamsatech.com` CORS) is unchanged (D8). Neither product consumes it.

## 20. Production-readiness blockers

1. **Secrets.** Generate two distinct product service secrets and set them on the portal (`LECTURESUITE_…` and `SCHOLARSUITE_…`) and on each product (`CENTRAL_ENTITLEMENT_SERVICE_SECRET`).
2. **Deployment configuration** (not edited in this phase). Both `docker-compose.prod.yml` backend services enumerate environment variables explicitly. Add:

    ```yaml
          CENTRAL_ENTITLEMENT_URL: ${CENTRAL_ENTITLEMENT_URL}
          CENTRAL_ENTITLEMENT_SERVICE_SECRET: ${CENTRAL_ENTITLEMENT_SERVICE_SECRET}
          # optional; unset ⇒ direct signup disabled
          DISABLE_DIRECT_SIGNUP: ${DISABLE_DIRECT_SIGNUP:-true}
    ```

    Apply the equivalent to k8s, Railway or any other runtime. Without them the product backends **refuse to start**, which fails closed.
3. **Release order.** Deploy the portal endpoint and secrets **before** the products. A product deployed first denies every login and refresh with 503.
4. **Paid-through data.** Existing subscribers need a populated `currentPeriodEnd` (the backfill from AS-P0-SECURITY-004 and -005), otherwise the portal denies them **in the products too** now.
5. **Operator access decision** (section 19, item 2).
6. **Monitoring.** Alert on `entitlement.central_unreachable`, `entitlement.central_rejected_request` and portal `entitlement.verify_failed`.
7. **Carried over from earlier phases:**
    - provider sandboxes;
    - production read access;
    - the Paystack currency decision;
    - the role-identifier correction;
    - refund and dispute handling (AS-P0-SECURITY-007 and -008);
    - the local portal `.env` with `CRAFT_LAUNCH_SECRET` equal to `AUTH_JWT_SECRET`.

## 21. Final acceptance checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Product billing write routes cannot independently grant commercial access | ✅ Implemented and tested (routes and service guards) |
| 2 | Product-side automatic trials cannot grant access | ✅ |
| 3 | Direct signup is disabled by default | ✅ |
| 4 | Login cannot issue tokens without central entitlement | ✅ |
| 5 | Refresh cannot renew sessions without central entitlement | ✅ (capped at paid-through) |
| 6 | Central entitlement verification is authenticated server-to-server | ✅ (product-bound credential) |
| 7 | Verification failures fail closed | ✅ (6 failure classes tested) |
| 8 | Portal Quick Launch uses the entitlement-checked route | ✅ |
| 9 | The duplicate commercial billing cron is safely disabled | ✅ |
| 10 | Existing academic functionality preserved | ✅ (only billing writes and session issuance changed; collaboration worker untouched; 163 pre-existing product tests still pass) |
| 11 | Existing billing history preserved | ✅ (no model, record or read route removed; webhooks still record) |
| 12 | All relevant tests pass | ✅ (553 of 553 across the three repositories) |
| 13 | Protected user changes intact | ✅ (hashes unchanged; every file outside the intended set matches its start hash) |
| 14 | No schema or production data change | ✅ (no Prisma model, migration, `db push` or database connection in this phase) |
| 15 | No deployment, commit or push | ✅ (HEADs unchanged; 0 staged; 0 stashes) |

**Final safety verification** (performed after implementation, before this report was written):

- HEADs, branches, staged files (0) and stashes (0) are unchanged in all three repositories.
- Every file in the start manifests that was not intentionally edited has an identical SHA-256.
- The only changed or new files are those listed in section 4, plus this report.
- The five ScholarSuite `frontend/__*.mjs` deletions pre-date this phase.

**Recommendation for AS-P0-SECURITY-007: GO.** The containment is complete in code, the entitlement transport (D3) is now implemented as the approved server-to-server API, and the dispute policy (D1) is approved. AS-P0-SECURITY-007 is schema design and development-only migration work, which needs none of the section 20 deployment prerequisites. D4 (licence and seat scope) and D7 (provider-scoped invoice ids) should be settled at the start of AS-P0-SECURITY-007, because they shape that schema. AS-P0-SECURITY-006A itself must **not** be deployed until the section 20 blockers are cleared.
