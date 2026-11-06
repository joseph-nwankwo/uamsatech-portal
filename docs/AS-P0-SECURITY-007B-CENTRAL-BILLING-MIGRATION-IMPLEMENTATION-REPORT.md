# AS-P0-SECURITY-007B — Central Billing Migration Implementation Report

| | |
|---|---|
| **Phase** | AS-P0-SECURITY-007B: migration governance baseline and central billing foundation |
| **Date** | 2026-11-05 |
| **Repository** | `uamsatech` (central portal) only |
| **Database** | `uamsatech`, the local development database on a loopback PostgreSQL 18.4 server |
| **Recommendation** | **GO**, for this development implementation only (§25). It does **not** authorise any production migration. |

Evidence conventions:
- **Hashes** are the first 16 hex characters of SHA-256.
- **Database outputs** are quoted from the verification scripts. Every script connects only to loopback, refuses any other host, and redacts credentials.
- **No credential, connection string or secret appears in this report.**
- Each claim is marked **[Verified]**, which means a command or test was run and its output is quoted, or **[Assumption]**.

---

## 1. Executive summary

- **Baseline created.** The portal database `uamsatech` was previously managed only by `prisma db push` and had no migration history. It now has a governed baseline migration, `20261105090000_portal_baseline`. The baseline reproduces the existing dev schema exactly, including the one constraint Prisma does not represent (`subscriptions_billto_xor`) and the physical column order. **[Verified]**
- **Baseline proven before it was marked applied.**
  - **Scenario 1:** applied to a fresh throwaway database, the baseline produces a schema-only dump identical to dev (542 = 542 normalised lines, order-sensitive).
  - **Scenario 2:** dev compared with the baseline-built schema: identical, 9 of 9 checks passed. Prisma's own diff (dev against `schema.prisma`) is empty.
  - **Marked applied:** only after both scenarios passed, with `prisma migrate resolve --applied`, in `uamsatech` only. **[Verified]**
- **Additive migration applied.** The approved migration, `20261105090100_as_p0_007_central_billing_foundation`, was generated from the 007 design artifacts, kept separate from the baseline, and applied to dev with `prisma migrate deploy`. It adds:
  - 10 tables and 14 enums;
  - 5 nullable invoice snapshot columns;
  - 19 CHECK constraints, 6 partial unique indexes and 4 triggers;
  - D7: provider-scoped invoice uniqueness. **[Verified]**
- **Approved decision applied.** Two-person approval for operator grants is now enforced in the database: `approvedById` is NOT NULL, and the approver must differ from both the grantee and the issuer. The 007 design had left this open (007 report, line 442). **[Verified]**
- **Integrity checks.** All passed:
  - **Throwaway database:** 64 of 64 behavioural assertions, including the real concurrent seat race (exactly one winner) and preservation of historical invoices.
  - **Dev database:** all 32 original tables are byte-identical on their original columns after migration.
  - **Structure:** dev equals a throwaway database built from the migrations directory (974 = 974 lines, order-sensitive). **[Verified]**
- **Regression and safety.**
  - **Portal:** 311 of 311 tests (baseline 310, plus 1 new D7 test), `tsc`, `eslint`, `next build` and `prisma validate` all pass.
  - **Products:** LectureSuite and ScholarSuite are untouched (manifests and protected-file hashes match). `craftsuite` is untouched.
  - **Cleanup:** no throwaway databases remain.
  - **Git:** no commit, push, deploy, `db push` or production access. **[Verified]**

---

## 2. Starting repository state

All entries **[Verified]**, recorded at the start of 007B:

| Item | Value |
|---|---|
| Branch / HEAD | `master` / `abd27e51b111` |
| Staged / unstaged / untracked / stashes | 0 / 12 / 30 / 0 (prior-phase user work, preserved) |
| Start manifest | 42 changed or untracked files hashed (`uamsatech.start.sha256`); 0 mismatches against the 007 end manifest |
| `prisma/schema.prisma` | Clean against HEAD; hash recorded (`schema.start.sha256`) |
| `prisma/migrations/` | **Did not exist** |
| Prisma | 6.19.3 (`package.json#prisma` seed config, with a deprecation warning only) |
| 007 artifacts | `docs/AS-P0-SECURITY-007-design/*.proposal` and `README.md`, hashes recorded; `additions` and `supplement` identical to the 007 originals |
| Product repositories | LectureSuite 141-file manifest, ScholarSuite 42-file manifest (from 007) |

---

## 3. Starting database state

From the read-only reconnaissance (`recon.cjs`, a `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` session). All entries **[Verified]**:

```
TARGET { database: 'uamsatech', server: '::1/128', readOnlySession: 'on', postgres: '18.4' }
schemas: public
_prisma_migrations present: false
extensions: plpgsql 1.0
functions (non-system): 0 | triggers (non-internal): 0 | views: 0 | matviews: 0 | sequences: 0
tables: 32 | enums: 14
CHECK constraints:
   subscriptions.subscriptions_billto_xor: CHECK ((("organizationId" IS NOT NULL) <> ("userId" IS NOT NULL)))
partial or expression indexes: (none)
invoices: { total: 1, with_ref: 0, null_ref: 1 }   invoices by provider: [ STRIPE: 1 ]
dup (provider, ref): []   same ref across providers: []
invoice indexes: invoices_pkey; UNIQUE "invoices_providerInvoiceId_key" ("providerInvoiceId")
```

A per-table data fingerprint (row count plus the md5 of every row in a stable order) and a `pg_dump --schema-only` were saved before any change.

---

## 4. Actual database target and how it was verified

**[Verified]** Every connection made in this phase passed these guards (`lib.cjs`):
1. The configured host must be loopback (`localhost`, `127.0.0.1` or `::1`); otherwise the script aborts.
2. After connecting, `inet_server_addr()` must be loopback (it reported `::1/128`), and `current_database()` must equal the database name the caller asked for.
3. Read-only steps must also report `default_transaction_read_only = on`.
4. Before every Prisma CLI write, `prisma migrate status` was run with the intended URL, and its output had to name the intended database, for example `PostgreSQL database "uamsatech", schema "public" at "localhost:5432"`. This guarantees the `.env` value cannot silently override the target.
5. Write access is code-limited to `uamsatech` or `^as_p0_007b_[a-z0-9_]+$`. Throwaway databases can only be dropped if they match that pattern.
6. The URL reaches tools only through the process environment (and `PGPASSWORD` for `pg_dump`), never through argv or output.

The target is the **local development** database. No shared, staging or production server was reachable or contacted.

---

## 5. Existing migration-history findings

**[Verified]**
- `uamsatech` had **no** `_prisma_migrations` table, and the repository had no `prisma/migrations/` directory. The schema had been managed only by `prisma db push`.
- The repository's own docs record raw-SQL changes as well. For example, `docs/15-deployment.md` describes adding `users.avatarUrl` through `$executeRawUnsafe("ALTER TABLE …")`. This explains the column-order drift described in §6.
- The LectureSuite/ScholarSuite shared `craftsuite` history (3 recorded migrations) is separate, and was neither read for reconciliation nor modified.

---

## 6. Existing schema and Prisma discrepancies

**[Verified]**
- **Definitions:** `prisma migrate diff --from-url <uamsatech> --to-schema-datamodel prisma/schema.prisma --exit-code` reported **no difference**. Every table, column, type, default, index and foreign key Prisma models matches the database.
- **Column order:** Prisma-generated DDL differed from dev in **physical column order** in 8 tables, with no definition differences: `api_keys`, `audit_logs`, `blog_posts`, `invoices`, `newsletter_subscribers`, `plans`, `subscriptions`, `users`. These are columns that `db push` or raw `ALTER TABLE` appended later. Example for `invoices`: dev has `… "createdAt", "userId"`, while Prisma generates `"userId"` fourth.
- **Constraints:** one database constraint has no Prisma representation (§7).

---

## 7. The undocumented constraint and how it was preserved

**[Verified]**
- **The constraint:**
  ```sql
  "subscriptions_billto_xor" CHECK ((("organizationId" IS NOT NULL) <> ("userId" IS NOT NULL)))
  ```
- **Meaning:** exactly one bill-to party per subscription. Prisma never generates CHECK constraints, so it is absent from `schema.prisma`.
- **In the baseline:** it is reproduced verbatim in Part 2 of the baseline migration:
  ```sql
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billto_xor" CHECK ((("organizationId" IS NOT NULL) <> ("userId" IS NOT NULL)));
  ```
- **Preservation checks:**
  - It is present in the fresh throwaway database (Scenario 1 dump identical).
  - It is present in dev before and after the additive migration (`apply-dev.cjs`: "✓ pre-existing CHECK subscriptions_billto_xor preserved").
  - It is present in the 007B throwaway validation ("PASS baseline CHECK subscriptions_billto_xor still present after additive migration").
- It was **not** deleted, renamed or weakened. There are no other undocumented objects: 0 functions, 0 triggers, 0 views, 0 partial or expression indexes, and `plpgsql` is the only extension.

---

## 8. Baseline design and implementation

**[Verified]** Files:

| File | Hash | Lines |
|---|---|---|
| `prisma/migrations/migration_lock.toml` | `99836963713b4f5b` | 3 (`provider = "postgresql"`) |
| `prisma/migrations/20261105090000_portal_baseline/migration.sql` | `c2b0fcd7ce082b8b` | 688 |

Construction:
1. **Part 1** is `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, run offline with a dummy URL. It creates the 14 enums, 32 tables, indexes and foreign keys.
2. Within each `CREATE TABLE`, the column lines were **reordered** to dev's physical order (`reorder.cjs`). Only line order changed; a multiset check confirmed every line's text was kept verbatim ("identical line multiset ✓"). This makes the baseline reproduce the actual database rather than an idealised one (decision G2).
3. **Part 2** adds `subscriptions_billto_xor`.
4. The namespace stays `public`. There is no `platform` schema and no `craftsuite` object (decisions G1 and G3: the portal owns its own migration stream).
5. The timestamp `20261105090000` is the phase date. The additive migration (`…090100`) sorts after it.
6. Prisma's recorded checksum for the baseline (`c2b0fcd7ce082b8b…`) equals the file's SHA-256, so the file applied is byte-for-byte the file in the repository.

---

## 9. Fresh-database baseline validation (Scenario 1)

**[Verified]** `scenario1.cjs` steps and their output:
1. Created throwaway database `as_p0_007b_baseline_77347b7d`.
2. Status guard: `prisma migrate status targets "as_p0_007b_baseline_77347b7d" ✓`.
3. Ran `prisma migrate deploy`, which printed ``Applying migration `20261105090000_portal_baseline` ``.
4. History: `20261105090000_portal_baseline`, done, not rolled back, 1 step.
5. Ran `pg_dump --schema-only` and compared it with dev, excluding `_prisma_migrations`:
   ```
   compare dev.schema.before.sql vs fresh: 542 vs 542 normalised lines; only-in-reference=0 only-in-fresh=0
   order-sensitive identical: true
   tables compared: 32; definition diffs: 0; order-only diffs: 0
   ```
6. Dropped the throwaway database (`dropped … confirmed`).

The first run, before reordering, showed 8 order-only differences and 0 definition differences, which is what led to step 2 in §8.

Prisma equivalence (`prisma-equivalence.cjs`, run with a throwaway shadow database that was then dropped):

```
migrations ⇔ schema.prisma: NO DIFFERENCE ✓
dev database (introspected) ⇔ schema.prisma: NO DIFFERENCE ✓
```

---

## 10. Existing-development-database baseline comparison (Scenario 2)

**[Verified]** `scenario2.cjs`, read-only:

```
✓ target is uamsatech on loopback, read-only session — server ::1/128, PostgreSQL 18.4
✓ _prisma_migrations absent before resolve
✓ data fingerprint unchanged since reconnaissance — 32/32 tables identical
✓ pg_dump: dev vs baseline-built — set comparison — 542 vs 542 lines; only-dev=0 only-baseline=0
✓ pg_dump: dev vs baseline-built — order-sensitive identical
✓ dev schema unchanged since reconnaissance
✓ per-table column definitions and order — tables compared: 32; definition diffs: 0; order-only diffs: 0
✓ guard: prisma migrate status names "uamsatech"
✓ status lists only the baseline as not yet applied
SCENARIO 2: PROVEN MATCH
```

There is no unexplained drift.

---

## 11. Whether and where the baseline was marked applied

**[Verified]** The baseline was marked applied **only in `uamsatech` (local development)**, and only after Scenario 2 passed. The script re-ran all nine checks in the same invocation, and would have called `resolve` only if every one passed:

```
Datasource "db": PostgreSQL database "uamsatech", schema "public" at "localhost:5432"
Migration 20261105090000_portal_baseline marked as applied.
history: [{ migration_name: '20261105090000_portal_baseline', done: true, not_rolled_back: true, applied_steps_count: 0 }]
Database schema is up to date!
```

`applied_steps_count: 0` is how Prisma records a migration that was resolved rather than executed. **No other environment was marked.**

---

## 12. Additive migration contents

**[Verified]** `prisma/migrations/20261105090100_as_p0_007_central_billing_foundation/migration.sql`: hash `cdbfd6a3d6a17ed0`, 565 lines, recorded checksum equal to the file's SHA-256.

**Part 1: Prisma-generated.** `migrate diff` from the pre-007B schema (proven equal to the baseline) to the new `schema.prisma`, run offline.

**Part 2: constraints Prisma cannot express.** This is `supplement.sql.proposal` verbatim, except for:
- the header comment, and the "REQUIRES APPROVAL" notes, which became "(approved, 007B)";
- the **operator approver CHECK**, changed from `approvedById IS NULL OR (…)` to `"approvedById" <> "userId" AND "approvedById" <> "issuedById"`.

The change to `prisma/schema.prisma` was built with `build.cjs.proposal`, plus one approved change in `finalize-schema.cjs`:
- `OperatorGrant.approvedById String` (was `String?`) and `approvedBy User` (was `User?`), with a doc comment stating the two-person rule;
- an updated header comment pointing at the migration.

`prisma format` also re-aligned whitespace in the existing `Coupon` model. This is formatting only and makes no semantic change.

Safety gate in `make-additive.cjs`:

```
destructive statements in generated part: [ 'DROP INDEX "invoices_providerInvoiceId_key";' ]
```

The only destructive statement is the D7 index swap (§15). No column, row, table or other constraint is dropped or rewritten. No backfill is performed: the five new invoice columns are nullable and remain NULL (§22).

---

## 13. Exact tables and enums created

**[Verified]** Present in dev after deploy, all empty:

| Table | Purpose |
|---|---|
| `provider_events` | every webhook delivery; idempotency `UNIQUE(provider, providerEventId)` |
| `entitlement_periods` | payment-to-period ledger; `UNIQUE(invoiceId, subscriptionId)` |
| `payment_refunds` | `UNIQUE(provider, providerRefundId)` |
| `payment_disputes` | `UNIQUE(provider, providerDisputeId)`; link to the suspended period |
| `organization_institution_links` | verified organisation ↔ product-institution mapping |
| `institution_licences` | `INSTITUTION_WIDE` or `SEAT_BASED` |
| `licence_seats` | seat assignments |
| `trial_grants` | centrally authorised trials |
| `operator_grants` | bounded two-person operator grants |
| `entitlement_changes` | append-only entitlement audit (no foreign keys) |

**Enums (14):**
- `EntitlementPeriodState`, `RefundStatus`, `DisputeStatus`
- `ProviderEventVerification`, `ProviderEventProcessing`
- `InstitutionLinkStatus`, `InstitutionLinkVerification`
- `LicenceType`, `LicenceStatus`, `SeatStatus`
- `GrantStatus`, `TrialTarget`
- `EntitlementSource`, `EntitlementActorType`

**Altered:** `invoices` gains `productPlanId`, `planInterval`, `priceCentsSnapshot`, `couponIdSnapshot` and `verifiedAt`, all nullable, plus the D7 index change.

Database totals: 32 → **42** tables; 14 → **28** enums.

---

## 14. Foreign-key and constraint verification

All **[Verified]** on dev after deploy (`apply-dev.cjs`):

- **Constraint inventory:**
  ```
  { checks: 20, triggers: 4, partial_idx: 6, cross_schema_fks: 0 }
  ```
- **CHECKs (20 = 1 existing + 19 new):**
  - existing: `subscriptions_billto_xor`;
  - `entitlement_periods`: `window`, `amount`;
  - `payment_refunds`: `amount`; `payment_disputes`: `amount`;
  - `org_inst_links`: `verified`, `two_party`;
  - `institution_licences`: `window`, `seat_model`;
  - `licence_seats`: `release`;
  - `trial_grants`: `target`, `window`, `max_len` (30 days), `self`, `revoke`;
  - `operator_grants`: `window`, `max_len` (90 days), `not_self_issued`, `approver`, `revoke`.
- **Triggers (4):**
  - `licence_seats_capacity_trg`
  - `trial_grants_immutable_trg`
  - `operator_grants_immutable_trg`
  - `entitlement_changes_append_only_trg`
- **Partial unique indexes (6):**
  - `licence_seats_active_member_key`
  - `operator_grants_one_active_key`
  - `org_inst_links_live_org_product_key`
  - `org_inst_links_live_product_institution_key`
  - `trial_grants_one_active_link_key`
  - `trial_grants_one_active_user_key`
- **Foreign keys:** 70 in total, every one referencing a table in `public` of `uamsatech`. There is **no cross-database foreign key** and no foreign key to any product institution table: `productInstitutionId` is an opaque string by design.
- **Structure:** `dev = throwaway built from migrations (pg_dump set) — 974 vs 974; only-dev=0 only-throwaway=0` and `order-sensitive identical`. Separately, `migrations ⇔ schema.prisma: NO DIFFERENCE ✓` with the final schema.
- **Behaviour** was exercised in the throwaway database (`validate-007b.cjs`, 64 of 64 PASS). For example:
  - `links: the requester cannot verify their own link (two-party)`
  - `licences: SEAT_BASED requires a positive capacity`
  - `trials: longer than the maximum (30 days) is rejected`
  - `operator: longer than the maximum (90 days) is rejected`
  - `operator (007B): a grant without an approver is rejected (two-person rule mandatory)`
  - `operator (007B): the grantee cannot approve their own grant`
  - `operator (007B): the approver cannot be removed afterwards`
  - `audit: UPDATE is blocked`, `audit: DELETE is blocked`

**How `validate-007b.cjs` was derived** (`make-validator.cjs`): it is the 007 `validate.cjs.proposal` with checked, single-match string edits. None of the original 53 behavioural assertions was weakened or removed.
- **Apply phase:** the three "applies cleanly" checks were replaced by the real path dev took: execute the baseline, run `resolve`, seed history, run `migrate deploy`.
- **Fixtures:** three operator fixtures gained a valid approver, so they still exercise their intended CHECK rather than failing on NOT NULL.
- **Footprint:** the count excludes `_prisma_migrations`.

---

## 15. Provider-scoped invoice uniqueness verification (D7)

**[Verified]**
- **Pre-check on dev live rows:** `invoices total=1 with_ref=0 null_ref=1; duplicates (provider, providerInvoiceId)=0`, and no reference shared across providers. There is no conflict, so nothing needed rewriting, and nothing was rewritten.
- **DDL:** `DROP INDEX "invoices_providerInvoiceId_key"`, then `CREATE UNIQUE INDEX "invoices_provider_providerInvoiceId_key" ON "invoices"("provider","providerInvoiceId")`. The new rule is strictly weaker than the old one, so every existing row satisfies it.
- **NULL behaviour:** NULLS DISTINCT, the PostgreSQL default, chosen deliberately. Invoices without a provider identifier never conflict.
- **Throwaway evidence (`validate-007b.cjs`):**
  - `D7: historical invoices (incl. identifiers and repeated NULLs) preserved byte-for-byte`: 5 rows seeded before the additive migration, md5 equal after.
  - `D7: only the provider-scoped unique index remains (NULLS DISTINCT)`
  - `D7: same providerInvoiceId under DIFFERENT providers is accepted`
  - `D7: duplicate providerInvoiceId under the SAME provider is rejected` (23505 on `Key (provider, "providerInvoiceId")`)
  - `D7: NULL providerInvoiceId is allowed repeatedly (NULLS DISTINCT policy)`
- **Code moved to the compound key:**
  - `lib/billing/one-time-payment.ts`: idempotency lookup and the post-P2002 "is it really committed?" lookup, both `where: { provider_providerInvoiceId: { provider: input.provider, providerInvoiceId: input.reference } }`.
  - `app/api/billing/stripe/webhook/route.ts`: `recordStripeInvoice`, with `provider: "STRIPE"`.
  - `tests/unit/helpers/fake-billing-db.ts`: `findUnique` takes the compound key, and `create` raises P2002 only for the same `(provider, providerInvoiceId)`, mirroring the real index.
- **New unit test** (`tests/unit/billing-webhooks.test.ts`): `D7 (007B): the same reference from ANOTHER provider is not a duplicate; idempotency is provider-scoped`. A historical Flutterwave invoice with reference `psk_ref_1` does not block a Paystack payment with the same reference. The historical row is untouched, and a second Paystack delivery is still a duplicate.

---

## 16. Seat allocation concurrency verification

**[Verified]** In the throwaway database, on PostgreSQL 18.4, with two independent connections:
- A capacity-1 seat-based licence.
- Two transactions each insert an ACTIVE seat for a different member, then hold the transaction open for 400 ms.
- The capacity trigger takes `SELECT … FOR UPDATE` on the licence row.

Result: `PASS seats: concurrent race for the last seat → exactly one wins (ok, capacity)`, with exactly 1 active seat afterwards.

Related passes:
- `seats: a third assignment exceeds capacity`
- `seats: the released seat can be reassigned`
- `seats: cannot assign a seat on an institution-wide licence`
- `seats: cannot assign a seat on a suspended licence`
- `seats: duplicate active seat for the same member (capacity available) is rejected`

---

## 17. Payment-period, refund and dispute integrity tests

**[Verified]**

**Unit tests:** `tests/unit/billing-domain.test.ts`, 68 of 68 passing.

*Payment-period ledger:*
- `is independent of delivery order (every permutation yields the same ledger)`: all 120 permutations of five payments;
- `an older payment arriving late never shortens entitlement`;
- `two payments processed together both count (no overwrite)`;
- `a full refund removes ONLY that payment's period; later payments keep their full duration`;
- `a dispute against a LATER payment leaves the earlier period entitled`;
- `rejects a ledger containing the same payment twice`.

*Refunds:*
- `multiple partial refunds accumulate`;
- `a duplicate refund delivery does not double-count`;
- `the same refund id under different providers does not collide`;
- `an unverified refund is ignored`;
- `adjudication: failed refund → no change; partial → manual review; full → revoke`;
- `a refunded Stripe renewal invoice goes to manual review, not revocation`;
- `a verified payment reversal is treated as a full refund`.

*Disputes:*
- `an UNVERIFIED dispute does not suspend access`;
- `won (and closed) restores; lost revokes`;
- `restoration only clears THIS dispute: another open dispute keeps the payment suspended`;
- `duplicate and out-of-order dispute events are idempotent`.

**Database tests in the throwaway** (`validate-007b.cjs`):
- `ledger: the same payment cannot buy a second period for the same subscription`;
- `ledger: periodEnd must be after periodStart`;
- `refunds: multiple partial refunds on one payment are representable`;
- `refunds: a duplicate (provider, providerRefundId) delivery cannot create a second row`;
- `refunds: amount must be positive`;
- `disputes: a dispute linked to the payment and the suspended period`;
- `disputes: duplicate (provider, providerDisputeId) rejected`;
- `events: duplicate (provider, providerEventId) delivery rejected`.

**Existing webhook flow tests** (Paystack, Flutterwave and Stripe paid-through dates, carry-forward, idempotency, concurrency, out-of-order delivery) all pass: `billing-webhooks` 61, `billing-stripe` 37, `billing-paid-period` 24.

---

## 18. Regression test results

**[Verified]** Command: `npx vitest run` in `uamsatech`.

```
Test Files  13 passed (13)
     Tests  311 passed (311)
```

The baseline was 310. The +1 is the new D7 test; no test was removed or weakened.

Per file:

| File | Tests |
|---|---|
| `billing-domain` | 68 |
| `billing-webhooks` | 61 |
| `launch` | 51 |
| `billing-stripe` | 37 |
| `internal-entitlements` | 30 |
| `billing-paid-period` | 24 |
| `launch-links` | 10 |
| `security-headers` | 7 |
| `display-name` | 5 |
| `rate-limit` | 5 |
| `tokens` | 5 |
| `passwords` | 4 |
| `permissions` | 4 |

**Test environment.** The tests and the build were run with a distinct `CRAFT_LAUNCH_SECRET` in the *process* environment. The local `.env` launch secret equals `AUTH_JWT_SECRET`, and the 006A env guard correctly rejects that. This is a known local-configuration item from 006A (§23); `.env` was not modified.

**Product suites.** The LectureSuite (170) and ScholarSuite (141) suites were **not run**, as the brief requires: only the portal may be run or changed. Their source is byte-identical to the start manifests (§20).

---

## 19. Typecheck, lint and build results

All **[Verified]**:

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | exit 0 |
| `npx eslint .` | exit 0 |
| `npx prisma validate` | `The schema at prisma\schema.prisma is valid 🚀` |
| `npx prisma generate` | `Generated Prisma Client (v6.19.3)` |
| `npx next build` | exit 0. A first attempt without the process-level launch secret stopped at `CRAFT_LAUNCH_SECRET must differ from AUTH_JWT_SECRET` (the 006A guard working as designed); the rerun with a distinct secret succeeded. |

---

## 20. Repository safety verification

All **[Verified]**:

- **LectureSuite:** 141 of 141 manifest entries OK.
- **Protected LectureSuite files:** hashes unchanged.
  - `backend/src/services/billing/invoice.service.ts`: `f501986c0f3dbf61`
  - `providers/stripe.provider.ts`: `72350add0889698b`
  - `providers/flutterwave.provider.ts`: `e271e83363dce737`
- **ScholarSuite:** 42 of 42 OK. The current changed and untracked set (47) is those 42 plus the 5 `frontend/__*.mjs` files that were deleted before these phases and could not be hashed.
- **Portal:** files differing from the 007B start manifest are exactly the four intended (§21). New paths are exactly `prisma/schema.prisma` (tracked, clean at start) and the three migration files. All pre-existing user changes are intact.
- **`.proposal` files:** all five design files pass `sha256sum -c` (unchanged and not renamed).
- **Databases:**
  - No throwaway databases remain: `databases on loopback server: 16; throwaway leftovers (as_p0_*): none`.
  - `craftsuite`, read-only: `schemas=public; 007 tables present: none; no "platform" schema: true; migrations recorded: 3; any 007/007B migration: false`.
- **Git:** no commit, push, stash, reset, checkout or clean.
- **Prohibited actions:** no deploy, no `prisma db push`, no production access, and no provider live-configuration changes.

---

## 21. Files created and modified

All in `uamsatech`:

| Path | Status | Hash |
|---|---|---|
| `prisma/migrations/migration_lock.toml` | created | `99836963713b4f5b` |
| `prisma/migrations/20261105090000_portal_baseline/migration.sql` | created | `c2b0fcd7ce082b8b` |
| `prisma/migrations/20261105090100_as_p0_007_central_billing_foundation/migration.sql` | created | `cdbfd6a3d6a17ed0` |
| `prisma/schema.prisma` | modified (10 models, 14 enums, D7, back-relations, required approver) | `2b08b645abb4fa8f` |
| `lib/billing/one-time-payment.ts` | modified (compound-key lookups, doc comment) | `4a501984a6e87920` |
| `app/api/billing/stripe/webhook/route.ts` | modified (compound-key lookup) | `6b5719835dd4cf25` |
| `tests/unit/helpers/fake-billing-db.ts` | modified (compound key, provider-scoped P2002) | `400ac24ae84fe0e2` |
| `tests/unit/billing-webhooks.test.ts` | modified (+1 D7 test) | `560800f831533f3a` |
| `docs/AS-P0-SECURITY-007B-CENTRAL-BILLING-MIGRATION-IMPLEMENTATION-REPORT.md` | created (this report) | n/a |

`node_modules/@prisma/client` was regenerated, which is a local build artifact. Verification scripts and logs are kept **outside the repository**, in the session scratchpad (`…/scratchpad/p007b/`).

---

## 22. Database changes made

All **[Verified]**:

| Database | Change | Command |
|---|---|---|
| `uamsatech` (local dev) | `_prisma_migrations` created; baseline recorded as applied (0 steps) | `prisma migrate resolve --applied 20261105090000_portal_baseline` |
| `uamsatech` (local dev) | Additive migration executed | `prisma migrate deploy` |
| Throwaway `as_p0_007b_*` (4 databases: baseline Scenario 1, two shadow databases, validation) | Created, used and dropped (each confirmed) | script-controlled |

**Data integrity in dev:**
- `all original tables identical on their original columns — 32/32`.
- `no backfill: new invoice columns NULL on every existing row`.
- `10 new tables present and empty`.
- `prisma migrate status: Database schema is up to date!`.

No data was inserted, updated or deleted in dev. The fingerprints before and after are stored as `dev.data-fingerprint.{before,after}.json`.

---

## 23. Outstanding risks and blockers

There are no blockers for this development phase. Risks and follow-ups:

1. **CI still uses `db push`.** `.github/workflows/ci.yml:55` runs `npx prisma db push --skip-generate`, so CI neither exercises the migrations nor creates the CHECKs and triggers. It should run `prisma migrate deploy` against its service container. This needs approval; it was not changed, because CI and deploy configuration were outside this phase.
2. **`npm run db:push` still exists** (`package.json`), and `npm run db:migrate` maps to `prisma migrate dev`. On any database still managed by `db push`, `migrate dev` detects drift and **offers a reset**. Developers must not run it against an un-baselined database. These scripts need a governance decision; they were not changed.
3. **Other developer databases.** Any other local portal database built by `db push` has no history. Each must go through the same Scenario 2 comparison before `resolve`, and must not have the baseline marked applied blindly. Its column order may differ; that is harmless, but it must be confirmed.
4. **The domain evaluator does not yet check the approver.** `lib/billing/domain/entitlement-sources.ts` `evaluateOperatorSource` does not take `approvedById` into account. It is not wired into any route yet, and the database makes an unapproved grant impossible, but when it is wired it should also check approver ≠ grantee ≠ issuer. This is a follow-up and was not changed in this phase.
5. **Trials are not renewable by edit, but are re-grantable.** The immutable-window trigger prevents extension in place. After an ACTIVE trial is revoked, a *new* trial for the same target can still be authorised (one ACTIVE at a time). Whether "non-renewing" should also forbid a second trial per target per product is a policy question, not changed here.
6. **The new tables are not wired.** Webhooks do not yet write `provider_events`, `entitlement_periods`, refunds or disputes. Entitlement still comes from the existing code paths. Wiring is a later phase.
7. **Local `.env` launch secret.** The local `.env` has `CRAFT_LAUNCH_SECRET` equal to `AUTH_JWT_SECRET`, so the 006A guard stops the build. Set a distinct local value; this is a user action and the file was not edited.
8. **Prisma 7.** `package.json#prisma` is deprecated and will need a `prisma.config.ts` before upgrading.

---

## 24. Explicit production migration prerequisites

None of these has been done, and **none is authorised by this report**:

1. **Written approval** for a production migration window, with a named operator and a second reviewer.
2. **A verified, restorable backup** of the production portal database, with the restore tested.
3. **Identity proof** for the production target, equivalent to §4: host, database name, and `migrate status` naming the database. Run from an approved operator environment.
4. **A production Scenario 2:**
   - a read-only `pg_dump --schema-only` compared with the baseline-built schema;
   - presence of `subscriptions_billto_xor`;
   - no unexpected objects;
   - no existing `_prisma_migrations`.
   - **Column order may differ from dev.** If definitions match and only order differs, record it and get approval before `resolve`.
   - Any definition difference is a stop.
5. **A production D7 pre-check:** count `(provider, providerInvoiceId)` duplicates (must be 0) and NULL references. If any duplicate exists, stop. Never rewrite historical identifiers.
6. **Order of operations:**
   1. `prisma migrate resolve --applied 20261105090000_portal_baseline`, only after step 4 passes;
   2. `prisma migrate deploy` (the additive migration);
   3. then deploy application code that uses the `provider_providerInvoiceId` compound key.

   Old code remains functional against the new schema in the interim.
7. **Post-deploy verification:** history, the structure comparison against a throwaway built from the migrations, and data fingerprints of the original tables.
8. **Rollback plan.** The migration is additive. Rollback means restoring the backup, or a reviewed down-script (drop the 10 tables, 14 enums and 5 columns, and restore the global unique index only if no cross-provider duplicates exist yet). Prepare and review this before the window.
9. **CI fixed to run `migrate deploy`** (§23.1), and the `db push` and `migrate dev` scripts governed (§23.2), before production.

---

## 25. Final recommendation

## **GO**, for this development implementation only

Every GO criterion in the brief is met with evidence:

| Criterion | Evidence |
|---|---|
| Dev database positively identified | §4: loopback `::1`, `current_database() = uamsatech`, status guard |
| Baseline accurately represents the database | §8–§10: 542 = 542 lines, order-sensitive identical; Prisma diff empty |
| Undocumented constraint preserved | §7 |
| Fresh-database baseline validation passes | §9 |
| Existing dev comparison passes | §10: 9 of 9 checks |
| Additive migration applies | §12, §22: `migrate deploy` succeeded; history shows 2 finished migrations |
| Expected tables, enums, constraints and indexes verified | §13, §14: 10 tables, 14 enums, 19 + 1 CHECKs, 6 partial indexes, 4 triggers, 70 foreign keys, none cross-database |
| Invoice uniqueness behaviour correct | §15 |
| Seat concurrency test passes | §16 |
| Period, refund and dispute integrity tests pass | §17 |
| Portal regression and quality checks pass | §18, §19: 311 of 311; `tsc`, `eslint`, build and `validate` all pass |
| Repository safety checks pass | §20 |

This GO does **not** authorise production deployment or any production migration; see §24. The items in §23 are follow-ups, not blockers for this development stage.
