-- AS-P0-SECURITY-007B — central billing & entitlement foundation (additive).
-- Source design: docs/AS-P0-SECURITY-007-design/{additions.prisma,supplement.sql}.proposal
-- Applied after 20261105090000_portal_baseline. Adds 10 tables and 14 enums,
-- Invoice snapshot columns, and D7 (provider-scoped invoice identifiers).
-- No existing column, row or constraint is removed, except that the global
-- unique index on invoices."providerInvoiceId" is replaced by a unique index on
-- (provider, "providerInvoiceId") — strictly weaker, so every existing row
-- still satisfies it; historical identifiers are not touched.
-- NULLS DISTINCT (the PostgreSQL default) is intentional: invoices without a
-- provider identifier never conflict with each other.

-- ════════ Part 1 — Prisma-generated DDL ════════
-- CreateEnum
CREATE TYPE "EntitlementPeriodState" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProviderEventVerification" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProviderEventProcessing" AS ENUM ('RECEIVED', 'PROCESSING', 'APPLIED', 'IGNORED', 'DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "InstitutionLinkStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InstitutionLinkVerification" AS ENUM ('PRODUCT_OWNER_CHALLENGE', 'OPERATOR_EVIDENCE');

-- CreateEnum
CREATE TYPE "LicenceType" AS ENUM ('INSTITUTION_WIDE', 'SEAT_BASED');

-- CreateEnum
CREATE TYPE "LicenceStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "TrialTarget" AS ENUM ('USER', 'INSTITUTION');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('SUBSCRIPTION', 'LICENCE', 'TRIAL', 'OPERATOR');

-- CreateEnum
CREATE TYPE "EntitlementActorType" AS ENUM ('PROVIDER', 'USER', 'OPERATOR', 'SYSTEM');

-- DropIndex
DROP INDEX "invoices_providerInvoiceId_key";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "couponIdSnapshot" TEXT,
ADD COLUMN     "planInterval" "PlanInterval",
ADD COLUMN     "priceCentsSnapshot" INTEGER,
ADD COLUMN     "productPlanId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "provider_events" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "verification" "ProviderEventVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "processing" "ProviderEventProcessing" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorClass" TEXT,
    "payloadSha256" TEXT NOT NULL,
    "facts" JSONB,
    "invoiceId" TEXT,
    "refundId" TEXT,
    "disputeId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_periods" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "interval" "PlanInterval",
    "providerPeriodStart" TIMESTAMP(3),
    "providerPeriodEnd" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "state" "EntitlementPeriodState" NOT NULL DEFAULT 'ACTIVE',
    "stateReason" TEXT,
    "stateSourceRefundId" TEXT,
    "stateSourceDisputeId" TEXT,
    "productPlanIdSnapshot" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerRefundId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerStatus" TEXT,
    "requestedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureClass" TEXT,
    "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_disputes" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerDisputeId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "providerStatus" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "evidenceDueBy" TIMESTAMP(3),
    "evidenceSubmittedAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "suspendedPeriodId" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_institution_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productInstitutionId" TEXT NOT NULL,
    "status" "InstitutionLinkStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" "InstitutionLinkVerification",
    "challengeSha256" TEXT,
    "challengeExpiresAt" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_institution_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_licences" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "licenceType" "LicenceType" NOT NULL,
    "status" "LicenceStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "productPlanId" TEXT,
    "seatCapacity" INTEGER,
    "sourceSubscriptionId" TEXT,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_licences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licence_seats" (
    "id" TEXT NOT NULL,
    "licenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releaseReason" TEXT,

    CONSTRAINT "licence_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_grants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetType" "TrialTarget" NOT NULL,
    "userId" TEXT,
    "linkId" TEXT,
    "status" "GrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "GrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_changes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "subjectOrganizationId" TEXT,
    "source" "EntitlementSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorType" "EntitlementActorType" NOT NULL,
    "actorId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "providerEventId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_events_processing_receivedAt_idx" ON "provider_events"("processing", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_events_provider_providerEventId_key" ON "provider_events"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "entitlement_periods_subscriptionId_paidAt_invoiceId_idx" ON "entitlement_periods"("subscriptionId", "paidAt", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_periods_invoiceId_subscriptionId_key" ON "entitlement_periods"("invoiceId", "subscriptionId");

-- CreateIndex
CREATE INDEX "payment_refunds_invoiceId_status_idx" ON "payment_refunds"("invoiceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_provider_providerRefundId_key" ON "payment_refunds"("provider", "providerRefundId");

-- CreateIndex
CREATE INDEX "payment_disputes_invoiceId_idx" ON "payment_disputes"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_disputes_provider_providerDisputeId_key" ON "payment_disputes"("provider", "providerDisputeId");

-- CreateIndex
CREATE INDEX "organization_institution_links_organizationId_productId_idx" ON "organization_institution_links"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "organization_institution_links_productId_productInstitution_idx" ON "organization_institution_links"("productId", "productInstitutionId");

-- CreateIndex
CREATE INDEX "institution_licences_linkId_productId_status_idx" ON "institution_licences"("linkId", "productId", "status");

-- CreateIndex
CREATE INDEX "licence_seats_licenceId_status_idx" ON "licence_seats"("licenceId", "status");

-- CreateIndex
CREATE INDEX "licence_seats_userId_idx" ON "licence_seats"("userId");

-- CreateIndex
CREATE INDEX "trial_grants_productId_userId_idx" ON "trial_grants"("productId", "userId");

-- CreateIndex
CREATE INDEX "trial_grants_productId_linkId_idx" ON "trial_grants"("productId", "linkId");

-- CreateIndex
CREATE INDEX "operator_grants_userId_productId_status_idx" ON "operator_grants"("userId", "productId", "status");

-- CreateIndex
CREATE INDEX "entitlement_changes_productId_createdAt_idx" ON "entitlement_changes"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "entitlement_changes_source_sourceId_idx" ON "entitlement_changes"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_provider_providerInvoiceId_key" ON "invoices"("provider", "providerInvoiceId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_productPlanId_fkey" FOREIGN KEY ("productPlanId") REFERENCES "product_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "payment_refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "payment_disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_periods" ADD CONSTRAINT "entitlement_periods_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_periods" ADD CONSTRAINT "entitlement_periods_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_periods" ADD CONSTRAINT "entitlement_periods_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_suspendedPeriodId_fkey" FOREIGN KEY ("suspendedPeriodId") REFERENCES "entitlement_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_institution_links" ADD CONSTRAINT "organization_institution_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_institution_links" ADD CONSTRAINT "organization_institution_links_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_institution_links" ADD CONSTRAINT "organization_institution_links_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_institution_links" ADD CONSTRAINT "organization_institution_links_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_institution_links" ADD CONSTRAINT "organization_institution_links_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_licences" ADD CONSTRAINT "institution_licences_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "organization_institution_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_licences" ADD CONSTRAINT "institution_licences_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_licences" ADD CONSTRAINT "institution_licences_productPlanId_fkey" FOREIGN KEY ("productPlanId") REFERENCES "product_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_licences" ADD CONSTRAINT "institution_licences_sourceSubscriptionId_fkey" FOREIGN KEY ("sourceSubscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_licences" ADD CONSTRAINT "institution_licences_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_seats" ADD CONSTRAINT "licence_seats_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "institution_licences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_seats" ADD CONSTRAINT "licence_seats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_seats" ADD CONSTRAINT "licence_seats_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_seats" ADD CONSTRAINT "licence_seats_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_grants" ADD CONSTRAINT "trial_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_grants" ADD CONSTRAINT "trial_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_grants" ADD CONSTRAINT "trial_grants_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "organization_institution_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_grants" ADD CONSTRAINT "trial_grants_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_grants" ADD CONSTRAINT "trial_grants_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_grants" ADD CONSTRAINT "operator_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_grants" ADD CONSTRAINT "operator_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_grants" ADD CONSTRAINT "operator_grants_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_grants" ADD CONSTRAINT "operator_grants_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_grants" ADD CONSTRAINT "operator_grants_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════ Part 2 — constraints Prisma cannot express ════════
-- ── Ledger integrity ──────────────────────────────────────────────────────
ALTER TABLE "entitlement_periods"
  ADD CONSTRAINT "entitlement_periods_window_chk" CHECK ("periodEnd" > "periodStart"),
  ADD CONSTRAINT "entitlement_periods_amount_chk" CHECK ("amountCents" >= 0);

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_amount_chk" CHECK ("amountCents" > 0);

ALTER TABLE "payment_disputes"
  ADD CONSTRAINT "payment_disputes_amount_chk" CHECK ("amountCents" > 0);

-- ── Organization ↔ institution link: one live link per product institution,
--    and one live link per (organization, product). Revoked links are history.
CREATE UNIQUE INDEX "org_inst_links_live_product_institution_key"
  ON "organization_institution_links" ("productId", "productInstitutionId")
  WHERE "status" <> 'REVOKED';
CREATE UNIQUE INDEX "org_inst_links_live_org_product_key"
  ON "organization_institution_links" ("organizationId", "productId")
  WHERE "status" <> 'REVOKED';
ALTER TABLE "organization_institution_links"
  ADD CONSTRAINT "org_inst_links_verified_chk" CHECK (
    "status" <> 'VERIFIED'
    OR ("verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "verificationMethod" IS NOT NULL)
  ),
  ADD CONSTRAINT "org_inst_links_two_party_chk" CHECK ("verifiedById" IS NULL OR "verifiedById" <> "requestedById");

-- ── Licences ─────────────────────────────────────────────────────────────
ALTER TABLE "institution_licences"
  ADD CONSTRAINT "institution_licences_window_chk" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "institution_licences_seat_model_chk" CHECK (
    ("licenceType" = 'SEAT_BASED'       AND "seatCapacity" IS NOT NULL AND "seatCapacity" > 0)
    OR ("licenceType" = 'INSTITUTION_WIDE' AND "seatCapacity" IS NULL)
  );

-- A member holds at most one ACTIVE seat per licence; released seats are history.
CREATE UNIQUE INDEX "licence_seats_active_member_key"
  ON "licence_seats" ("licenceId", "userId") WHERE "status" = 'ACTIVE';
ALTER TABLE "licence_seats"
  ADD CONSTRAINT "licence_seats_release_chk" CHECK (
    ("status" = 'ACTIVE' AND "releasedAt" IS NULL) OR ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL)
  );

-- Database-level seat ceiling (defense in depth behind the application's
-- SELECT … FOR UPDATE on the licence row): locks the licence, refuses a new
-- ACTIVE seat on a licence that is not an ACTIVE seat-based licence or is full.
CREATE OR REPLACE FUNCTION "licence_seats_enforce_capacity"() RETURNS trigger AS $$
DECLARE
  lic RECORD;
  used integer;
BEGIN
  IF NEW."status" <> 'ACTIVE' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'ACTIVE' THEN RETURN NEW; END IF;
  SELECT "licenceType", "status", "seatCapacity" INTO lic
    FROM "institution_licences" WHERE "id" = NEW."licenceId" FOR UPDATE;
  IF lic."licenceType" <> 'SEAT_BASED' THEN
    RAISE EXCEPTION 'seat_on_non_seat_licence' USING ERRCODE = 'check_violation';
  END IF;
  IF lic."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'seat_on_inactive_licence' USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO used FROM "licence_seats"
    WHERE "licenceId" = NEW."licenceId" AND "status" = 'ACTIVE' AND "id" <> NEW."id";
  IF used >= lic."seatCapacity" THEN
    RAISE EXCEPTION 'seat_capacity_exhausted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "licence_seats_capacity_trg"
  BEFORE INSERT OR UPDATE OF "status" ON "licence_seats"
  FOR EACH ROW EXECUTE FUNCTION "licence_seats_enforce_capacity"();

-- ── Trials: centrally authorized, bounded, single target, non-renewing ──
ALTER TABLE "trial_grants"
  ADD CONSTRAINT "trial_grants_target_chk" CHECK (
    ("targetType" = 'USER'        AND "userId" IS NOT NULL AND "linkId" IS NULL)
    OR ("targetType" = 'INSTITUTION' AND "linkId" IS NOT NULL AND "userId" IS NULL)
  ),
  ADD CONSTRAINT "trial_grants_window_chk" CHECK ("endsAt" > "startsAt"),
  -- Maximum trial length: 30 days (approved, 007B).
  ADD CONSTRAINT "trial_grants_max_len_chk" CHECK ("endsAt" - "startsAt" <= interval '30 days'),
  ADD CONSTRAINT "trial_grants_self_chk" CHECK ("userId" IS NULL OR "userId" <> "authorizedById"),
  ADD CONSTRAINT "trial_grants_revoke_chk" CHECK (
    ("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL)
  );
CREATE UNIQUE INDEX "trial_grants_one_active_user_key"
  ON "trial_grants" ("productId", "userId") WHERE "status" = 'ACTIVE' AND "userId" IS NOT NULL;
CREATE UNIQUE INDEX "trial_grants_one_active_link_key"
  ON "trial_grants" ("productId", "linkId") WHERE "status" = 'ACTIVE' AND "linkId" IS NOT NULL;

-- ── Operator grants: explicit, bounded, never self-issued ────────────────
ALTER TABLE "operator_grants"
  ADD CONSTRAINT "operator_grants_window_chk" CHECK ("endsAt" > "startsAt"),
  -- Maximum operator grant: 90 days, renewal = a new grant (approved, 007B).
  ADD CONSTRAINT "operator_grants_max_len_chk" CHECK ("endsAt" - "startsAt" <= interval '90 days'),
  ADD CONSTRAINT "operator_grants_not_self_issued_chk" CHECK ("issuedById" <> "userId"),
  -- Two-person rule (mandatory, 007B decision): approvedById is NOT NULL and the
  -- approver differs from both the grantee and the issuer.
  ADD CONSTRAINT "operator_grants_approver_chk" CHECK (
    "approvedById" <> "userId" AND "approvedById" <> "issuedById"
  ),
  ADD CONSTRAINT "operator_grants_revoke_chk" CHECK (
    ("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL)
  );
CREATE UNIQUE INDEX "operator_grants_one_active_key"
  ON "operator_grants" ("userId", "productId") WHERE "status" = 'ACTIVE';

-- Grant windows are immutable: extending a trial or operator grant requires a
-- NEW explicit authorization row. Only revocation fields may change.
CREATE OR REPLACE FUNCTION "grants_window_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."startsAt" IS DISTINCT FROM OLD."startsAt" OR NEW."endsAt" IS DISTINCT FROM OLD."endsAt"
     OR NEW."productId" IS DISTINCT FROM OLD."productId" THEN
    RAISE EXCEPTION 'grant_window_immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" = 'REVOKED' AND NEW."status" <> 'REVOKED' THEN
    RAISE EXCEPTION 'grant_revocation_final' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "trial_grants_immutable_trg" BEFORE UPDATE ON "trial_grants"
  FOR EACH ROW EXECUTE FUNCTION "grants_window_immutable"();
CREATE TRIGGER "operator_grants_immutable_trg" BEFORE UPDATE ON "operator_grants"
  FOR EACH ROW EXECUTE FUNCTION "grants_window_immutable"();

-- ── Append-only entitlement audit ───────────────────────────────────────
CREATE OR REPLACE FUNCTION "entitlement_changes_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'entitlement_changes_append_only' USING ERRCODE = 'insufficient_privilege';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "entitlement_changes_append_only_trg" BEFORE UPDATE OR DELETE ON "entitlement_changes"
  FOR EACH ROW EXECUTE FUNCTION "entitlement_changes_append_only"();
