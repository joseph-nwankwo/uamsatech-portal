import { describe, it, expect } from "vitest";
import {
  reconstructPeriods, coverageAt, latestEntitlingEnd, type LedgerPayment,
} from "@/lib/billing/domain/period-ledger";
import {
  summarizeRefunds, nextRefundStatus, normalizeDisputeStatus, nextDisputeStatus,
  adjudicatePayment, reversalAsRefund, type RefundRecord, type DisputeRecord,
} from "@/lib/billing/domain/adjustments";
import {
  evaluateSubscriptionSource, evaluateLicenceSource, evaluateTrialSource, evaluateOperatorSource,
  combineEntitlement, type SourceVerdict,
} from "@/lib/billing/domain/entitlement-sources";

// AS-P0-SECURITY-007 — pure billing/entitlement domain (not yet wired to persistence).

const d = (iso: string) => new Date(iso);
const iso = (x: Date | null) => x?.toISOString() ?? null;
const oneOff = (invoiceId: string, paidAt: string, interval: "MONTHLY" | "YEARLY" = "MONTHLY", state: LedgerPayment["state"] = "ACTIVE"): LedgerPayment =>
  ({ kind: "ONE_OFF", invoiceId, paidAt: d(paidAt), interval, state });
const windows = (ps: LedgerPayment[]) => reconstructPeriods(ps).map((p) => `${p.invoiceId}:${p.state}:${iso(p.periodStart)}→${iso(p.periodEnd)}`);

// ═════════════════════════════════════════════════════════════════════════════
describe("payment-period ledger", () => {
  it("a verified payment creates exactly its purchased period", () => {
    const [p] = reconstructPeriods([oneOff("A", "2026-09-20T09:00:00Z")]);
    expect([iso(p.periodStart), iso(p.periodEnd), p.entitling]).toEqual(["2026-09-20T09:00:00.000Z", "2026-10-20T09:00:00.000Z", true]);
  });

  it("early renewal carries forward: it starts at the existing paid-through date", () => {
    expect(windows([oneOff("A", "2026-09-20T00:00:00Z"), oneOff("B", "2026-10-10T00:00:00Z")])).toEqual([
      "A:ACTIVE:2026-09-20T00:00:00.000Z→2026-10-20T00:00:00.000Z",
      "B:ACTIVE:2026-10-20T00:00:00.000Z→2026-11-20T00:00:00.000Z",
    ]);
  });

  it("renewal after expiry starts at the verified payment time", () => {
    expect(windows([oneOff("A", "2026-08-01T00:00:00Z"), oneOff("B", "2026-10-05T00:00:00Z")])[1])
      .toBe("B:ACTIVE:2026-10-05T00:00:00.000Z→2026-11-05T00:00:00.000Z");
  });

  it("the purchase-time interval snapshot is used, not the current plan", () => {
    const ps = [oneOff("A", "2026-09-01T00:00:00Z", "YEARLY"), oneOff("B", "2026-10-01T00:00:00Z", "MONTHLY")];
    expect(iso(latestEntitlingEnd(reconstructPeriods(ps)))).toBe("2027-10-01T00:00:00.000Z");
  });

  it("is independent of delivery order (every permutation yields the same ledger)", () => {
    const base = [
      oneOff("A", "2026-09-01T00:00:00Z"), oneOff("B", "2026-09-15T00:00:00Z", "YEARLY"),
      oneOff("C", "2026-10-01T00:00:00Z", "MONTHLY", "SUSPENDED"), oneOff("D", "2026-10-02T00:00:00Z", "MONTHLY", "REVOKED"),
      oneOff("E", "2026-10-03T00:00:00Z"),
    ];
    const expected = windows(base);
    const perms = (xs: LedgerPayment[]): LedgerPayment[][] => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
    const all = perms(base);
    expect(all).toHaveLength(120);
    for (const p of all) expect(windows(p).sort()).toEqual([...expected].sort());
  });

  it("an older payment arriving late never shortens entitlement", () => {
    const later = [oneOff("B", "2026-10-10T00:00:00Z")];
    const before = latestEntitlingEnd(reconstructPeriods(later))!;
    const after = latestEntitlingEnd(reconstructPeriods([...later, oneOff("A", "2026-09-01T00:00:00Z")]))!;
    expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("two payments processed together both count (no overwrite)", () => {
    const end = latestEntitlingEnd(reconstructPeriods([oneOff("A", "2026-09-20T00:00:00Z"), oneOff("B", "2026-10-01T00:00:00Z"), oneOff("C", "2026-10-02T00:00:00Z")]));
    expect(iso(end)).toBe("2026-12-20T00:00:00.000Z");
  });

  it("a full refund removes ONLY that payment's period; later payments keep their full duration", () => {
    const ps = [oneOff("A", "2026-09-01T00:00:00Z", "MONTHLY", "REVOKED"), oneOff("B", "2026-09-20T00:00:00Z"), oneOff("C", "2026-10-25T00:00:00Z")];
    expect(windows(ps)).toEqual([
      "A:REVOKED:null→null",
      "B:ACTIVE:2026-09-20T00:00:00.000Z→2026-10-20T00:00:00.000Z",
      "C:ACTIVE:2026-10-25T00:00:00.000Z→2026-11-25T00:00:00.000Z",
    ]);
  });

  it("multiple full refunds are each removed independently", () => {
    const ps = [oneOff("A", "2026-09-01T00:00:00Z", "MONTHLY", "REVOKED"), oneOff("B", "2026-09-02T00:00:00Z"), oneOff("C", "2026-09-03T00:00:00Z", "MONTHLY", "REVOKED"), oneOff("D", "2026-09-04T00:00:00Z")];
    expect(iso(latestEntitlingEnd(reconstructPeriods(ps)))).toBe("2026-11-02T00:00:00.000Z");
  });

  it("a suspended period keeps its time reserved but does not entitle", () => {
    const periods = reconstructPeriods([oneOff("A", "2026-09-01T00:00:00Z", "MONTHLY", "SUSPENDED"), oneOff("B", "2026-09-10T00:00:00Z")]);
    expect(iso(periods[1].periodStart)).toBe("2026-10-01T00:00:00.000Z");
    expect(coverageAt(periods, d("2026-09-15T00:00:00Z"))).toEqual({ entitled: false, reason: "suspended" });
    expect(coverageAt(periods, d("2026-10-15T00:00:00Z"))).toMatchObject({ entitled: true });
  });

  it("a dispute against a LATER payment leaves the earlier period entitled", () => {
    const periods = reconstructPeriods([oneOff("A", "2026-09-01T00:00:00Z"), oneOff("B", "2026-09-10T00:00:00Z", "MONTHLY", "SUSPENDED")]);
    expect(coverageAt(periods, d("2026-09-15T00:00:00Z"))).toEqual({ entitled: true, until: d("2026-10-01T00:00:00Z") });
    expect(coverageAt(periods, d("2026-10-15T00:00:00Z"))).toEqual({ entitled: false, reason: "suspended" });
  });

  it("coverage: contiguous entitling periods extend 'until'; gaps and expiry deny", () => {
    const periods = reconstructPeriods([oneOff("A", "2026-09-01T00:00:00Z"), oneOff("B", "2026-09-10T00:00:00Z")]);
    expect(coverageAt(periods, d("2026-09-05T00:00:00Z"))).toEqual({ entitled: true, until: d("2026-11-01T00:00:00Z") });
    expect(coverageAt(periods, d("2026-11-01T00:00:00Z"))).toEqual({ entitled: false, reason: "expired" });
    expect(coverageAt([], d("2026-11-01T00:00:00Z"))).toEqual({ entitled: false, reason: "no_periods" });
  });

  it("provider periods (Stripe) are taken as-is, never computed", () => {
    const [p] = reconstructPeriods([{ kind: "PROVIDER_PERIOD", invoiceId: "S1", paidAt: d("2026-10-20T00:05:00Z"), providerPeriodStart: d("2026-10-20T00:00:00Z"), providerPeriodEnd: d("2026-11-03T17:45:00Z"), state: "ACTIVE" }]);
    expect(iso(p.periodEnd)).toBe("2026-11-03T17:45:00.000Z");
  });

  it("rejects a ledger containing the same payment twice", () => {
    expect(() => reconstructPeriods([oneOff("A", "2026-09-01T00:00:00Z"), oneOff("A", "2026-09-01T00:00:00Z")])).toThrow(/duplicate/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
const refund = (id: string, amountCents: number, status: RefundRecord["status"], over: Partial<RefundRecord> = {}): RefundRecord =>
  ({ provider: "PAYSTACK", providerRefundId: id, amountCents, currency: "NGN", status, providerUpdatedAt: d("2026-10-01T00:00:00Z"), verified: true, ...over });
const dispute = (id: string, status: DisputeRecord["status"], over: Partial<DisputeRecord> = {}): DisputeRecord =>
  ({ provider: "STRIPE", providerDisputeId: id, status, providerUpdatedAt: d("2026-10-01T00:00:00Z"), verified: true, ...over });
const PAY = { amountCents: 150000, currency: "NGN", kind: "ONE_OFF" as const };

describe("refunds", () => {
  it("multiple partial refunds accumulate", () => {
    expect(summarizeRefunds(PAY, [refund("r1", 50000, "SUCCEEDED"), refund("r2", 30000, "SUCCEEDED")])).toEqual({ refundedCents: 80000, classification: "PARTIAL", currencyMismatch: false });
  });

  it("a duplicate refund delivery does not double-count", () => {
    expect(summarizeRefunds(PAY, [refund("r1", 50000, "SUCCEEDED"), refund("r1", 50000, "SUCCEEDED")]).refundedCents).toBe(50000);
  });

  it("the same refund id under different providers does not collide", () => {
    expect(summarizeRefunds(PAY, [refund("r1", 50000, "SUCCEEDED"), refund("r1", 50000, "SUCCEEDED", { provider: "FLUTTERWAVE" })]).refundedCents).toBe(100000);
  });

  it.each(["REQUESTED", "PENDING", "FAILED", "CANCELED", "REVERSED"] as const)("a %s refund is not a completed refund", (status) => {
    expect(summarizeRefunds(PAY, [refund("r1", 150000, status)]).classification).toBe("NONE");
  });

  it("an unverified refund is ignored", () => {
    expect(summarizeRefunds(PAY, [refund("r1", 150000, "SUCCEEDED", { verified: false })]).classification).toBe("NONE");
  });

  it("cumulative partials reaching the full amount classify as FULL", () => {
    expect(summarizeRefunds(PAY, [refund("r1", 100000, "SUCCEEDED"), refund("r2", 50000, "SUCCEEDED")]).classification).toBe("FULL");
  });

  it("status moves: older events never regress; terminal states are final; SUCCEEDED → REVERSED only", () => {
    const at = (s: string) => d(s);
    expect(nextRefundStatus({ status: "SUCCEEDED", providerUpdatedAt: at("2026-10-02T00:00:00Z") }, { status: "PENDING", providerUpdatedAt: at("2026-10-01T00:00:00Z") })).toBe("SUCCEEDED");
    expect(nextRefundStatus({ status: "FAILED", providerUpdatedAt: at("2026-10-01T00:00:00Z") }, { status: "SUCCEEDED", providerUpdatedAt: at("2026-10-02T00:00:00Z") })).toBe("FAILED");
    expect(nextRefundStatus({ status: "SUCCEEDED", providerUpdatedAt: at("2026-10-01T00:00:00Z") }, { status: "FAILED", providerUpdatedAt: at("2026-10-02T00:00:00Z") })).toBe("SUCCEEDED");
    expect(nextRefundStatus({ status: "SUCCEEDED", providerUpdatedAt: at("2026-10-01T00:00:00Z") }, { status: "REVERSED", providerUpdatedAt: at("2026-10-02T00:00:00Z") })).toBe("REVERSED");
    expect(nextRefundStatus({ status: "PENDING", providerUpdatedAt: at("2026-10-01T00:00:00Z") }, { status: "SUCCEEDED", providerUpdatedAt: at("2026-10-02T00:00:00Z") })).toBe("SUCCEEDED");
  });

  it("adjudication: failed refund → no change; partial → manual review; full → revoke", () => {
    expect(adjudicatePayment({ payment: PAY, refunds: [refund("r1", 150000, "FAILED")], disputes: [] })).toEqual({ state: "ACTIVE", reason: "none" });
    expect(adjudicatePayment({ payment: PAY, refunds: [refund("r1", 1000, "SUCCEEDED")], disputes: [] })).toEqual({ state: "PENDING_REVIEW", reason: "partial_refund" });
    expect(adjudicatePayment({ payment: PAY, refunds: [refund("r1", 150000, "SUCCEEDED")], disputes: [] })).toEqual({ state: "REVOKED", reason: "full_refund" });
  });

  it("a refunded Stripe renewal invoice goes to manual review, not revocation", () => {
    expect(adjudicatePayment({ payment: { ...PAY, kind: "PROVIDER_PERIOD" }, refunds: [refund("re_1", 150000, "SUCCEEDED", { provider: "STRIPE" })], disputes: [] }))
      .toEqual({ state: "PENDING_REVIEW", reason: "renewal_refund_review" });
  });

  it("a verified payment reversal is treated as a full refund", () => {
    const r = reversalAsRefund({ provider: "FLUTTERWAVE", providerReversalId: "rv1", amountCents: 150000, currency: "NGN", providerUpdatedAt: d("2026-10-01T00:00:00Z"), verified: true });
    expect(adjudicatePayment({ payment: PAY, refunds: [r], disputes: [] }).state).toBe("REVOKED");
  });

  it("a refund in another currency is routed to review rather than compared", () => {
    expect(adjudicatePayment({ payment: PAY, refunds: [refund("r1", 150000, "SUCCEEDED", { currency: "USD" })], disputes: [] })).toEqual({ state: "PENDING_REVIEW", reason: "currency_review" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("disputes", () => {
  it("maps verified Stripe dispute statuses; unmapped providers/values become UNKNOWN", () => {
    expect(["needs_response", "warning_needs_response", "under_review", "warning_under_review", "won", "lost", "warning_closed", "prevented"].map((s) => normalizeDisputeStatus("STRIPE", s)))
      .toEqual(["OPEN", "OPEN", "UNDER_REVIEW", "UNDER_REVIEW", "WON", "LOST", "CLOSED", "CLOSED"]);
    expect(normalizeDisputeStatus("STRIPE", "something_new")).toBe("UNKNOWN");
    expect(normalizeDisputeStatus("PAYSTACK", "pending")).toBe("UNKNOWN");
  });

  it("a verified open dispute suspends the affected payment", () => {
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [dispute("dp1", "OPEN")] })).toEqual({ state: "SUSPENDED", reason: "dispute_open" });
  });

  it("an UNVERIFIED dispute does not suspend access", () => {
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [dispute("dp1", "OPEN", { verified: false })] }).state).toBe("ACTIVE");
  });

  it("won (and closed) restores; lost revokes", () => {
    const opened = dispute("dp1", "OPEN");
    const later = { providerUpdatedAt: d("2026-10-05T00:00:00Z") };
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [opened, dispute("dp1", "WON", later)] }).state).toBe("ACTIVE");
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [opened, dispute("dp1", "CLOSED", later)] }).state).toBe("ACTIVE");
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [opened, dispute("dp1", "LOST", later)] })).toEqual({ state: "REVOKED", reason: "dispute_lost" });
  });

  it("restoration only clears THIS dispute: another open dispute keeps the payment suspended", () => {
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [dispute("dp1", "WON"), dispute("dp2", "OPEN")] }).state).toBe("SUSPENDED");
  });

  it("duplicate and out-of-order dispute events are idempotent", () => {
    const won = dispute("dp1", "WON", { providerUpdatedAt: d("2026-10-05T00:00:00Z") });
    const staleOpen = dispute("dp1", "OPEN", { providerUpdatedAt: d("2026-10-01T00:00:00Z") });
    expect(adjudicatePayment({ payment: PAY, refunds: [], disputes: [won, staleOpen, won] }).state).toBe("ACTIVE");
    expect(nextDisputeStatus({ status: "LOST", providerUpdatedAt: d("2026-10-05T00:00:00Z") }, { status: "OPEN", providerUpdatedAt: d("2026-10-06T00:00:00Z") })).toBe("LOST");
    expect(nextDisputeStatus({ status: "OPEN", providerUpdatedAt: d("2026-10-05T00:00:00Z") }, { status: "UNKNOWN", providerUpdatedAt: d("2026-10-06T00:00:00Z") })).toBe("OPEN");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
const NOW = d("2026-11-04T12:00:00Z");
const P = "lecturesuite";
const verifiedLink = { productSlug: P, status: "VERIFIED" };
const licence = (over: Partial<Parameters<typeof evaluateLicenceSource>[0]["licence"]> = {}) =>
  ({ id: "lic", productSlug: P, licenceType: "INSTITUTION_WIDE" as const, status: "ACTIVE", startsAt: d("2026-01-01T00:00:00Z"), endsAt: d("2027-01-01T00:00:00Z"), ...over });

describe("institutional licences", () => {
  const ev = (o: Partial<Parameters<typeof evaluateLicenceSource>[0]> = {}) =>
    evaluateLicenceSource({ product: P, licence: licence(), link: verifiedLink, isMember: true, hasActiveSeat: false, now: NOW, ...o });

  it("an institution-wide licence grants eligible active members", () => { expect(ev()).toMatchObject({ valid: true, until: d("2027-01-01T00:00:00Z") }); });
  it("non-members are not granted", () => { expect(ev({ isMember: false })).toMatchObject({ valid: false, reason: "not_a_member" }); });
  it("an expired licence denies", () => { expect(ev({ licence: licence({ endsAt: d("2026-10-01T00:00:00Z") }) })).toMatchObject({ valid: false, reason: "expired" }); });
  it("a suspended licence denies", () => { expect(ev({ licence: licence({ status: "SUSPENDED" }) })).toMatchObject({ valid: false, reason: "suspended" }); });
  it("a revoked licence denies", () => { expect(ev({ licence: licence({ status: "REVOKED" }) })).toMatchObject({ valid: false, reason: "revoked" }); });
  it("a licence for one product does not grant another", () => { expect(ev({ product: "scholarsuite" })).toMatchObject({ valid: false, reason: "other_product" }); });
  it("an unverified or missing institution mapping does not grant", () => {
    expect(ev({ link: { productSlug: P, status: "PENDING" } })).toMatchObject({ valid: false, reason: "institution_link_unverified" });
    expect(ev({ link: null })).toMatchObject({ valid: false, reason: "institution_link_unverified" });
    expect(ev({ link: { productSlug: "scholarsuite", status: "VERIFIED" } })).toMatchObject({ valid: false, reason: "institution_link_unverified" });
  });
  it("a seat-based licence grants only members with an assigned seat", () => {
    const seat = licence({ licenceType: "SEAT_BASED" });
    expect(ev({ licence: seat, hasActiveSeat: false })).toMatchObject({ valid: false, reason: "no_seat_assigned" });
    expect(ev({ licence: seat, hasActiveSeat: true })).toMatchObject({ valid: true });
    expect(ev({ licence: seat, hasActiveSeat: true, isMember: false })).toMatchObject({ valid: false, reason: "not_a_member" });
  });
});

describe("operator grants", () => {
  const grant = (over = {}) => ({ id: "og", productSlug: P, userId: "u1", status: "ACTIVE", startsAt: d("2026-11-01T00:00:00Z"), endsAt: d("2026-12-01T00:00:00Z"), issuedById: "staff", ...over });
  const ev = (o: Partial<Parameters<typeof evaluateOperatorSource>[0]> = {}) =>
    evaluateOperatorSource({ product: P, grant: grant(), issuerAuthorized: true, userId: "u1", now: NOW, ...o });

  it("an authorized grant permits only its product", () => {
    expect(ev()).toMatchObject({ valid: true });
    expect(ev({ product: "scholarsuite" })).toMatchObject({ valid: false, reason: "other_product" });
  });
  it("expired and revoked grants deny", () => {
    expect(ev({ grant: grant({ endsAt: d("2026-11-02T00:00:00Z") }) })).toMatchObject({ valid: false, reason: "expired" });
    expect(ev({ grant: grant({ status: "REVOKED" }) })).toMatchObject({ valid: false, reason: "revoked" });
  });
  it("a self-issued grant, or one from an unauthorized issuer, denies", () => {
    expect(ev({ grant: grant({ issuedById: "u1" }) })).toMatchObject({ valid: false, reason: "self_issued" });
    expect(ev({ issuerAuthorized: false })).toMatchObject({ valid: false, reason: "issuer_not_authorized" });
  });
  it("a product administrator role alone is not a source of entitlement", () => {
    // There is no "role" input at all: only an explicit central grant can produce an OPERATOR verdict.
    expect(combineEntitlement([])).toMatchObject({ decision: "DENIED", status: "NONE" });
  });
  it("a grant for another user does not apply", () => { expect(ev({ userId: "u2" })).toMatchObject({ valid: false, reason: "other_user" }); });
});

describe("centrally authorized trials", () => {
  const trial = (over = {}) => ({ id: "t", productSlug: P, targetType: "USER" as const, status: "ACTIVE", startsAt: d("2026-11-01T00:00:00Z"), endsAt: d("2026-11-15T00:00:00Z"), authorizedById: "staff", ...over });
  const ev = (o: Partial<Parameters<typeof evaluateTrialSource>[0]> = {}) =>
    evaluateTrialSource({ product: P, trial: trial(), link: null, isMember: false, userId: "u1", now: NOW, ...o });

  it("grants within its window", () => { expect(ev()).toMatchObject({ valid: true, until: d("2026-11-15T00:00:00Z") }); });
  it("expired and revoked trials deny", () => {
    expect(ev({ now: d("2026-11-16T00:00:00Z") })).toMatchObject({ valid: false, reason: "expired" });
    expect(ev({ trial: trial({ status: "REVOKED" }) })).toMatchObject({ valid: false, reason: "revoked" });
  });
  it("a trial for one product does not grant another", () => { expect(ev({ product: "scholarsuite" })).toMatchObject({ valid: false, reason: "other_product" }); });
  it("a self-authorized trial is not valid", () => { expect(ev({ trial: trial({ authorizedById: "u1" }) })).toMatchObject({ valid: false, reason: "self_authorized" }); });
  it("an institution-sponsored trial needs a verified mapping and membership", () => {
    const inst = trial({ targetType: "INSTITUTION" });
    expect(ev({ trial: inst, link: { productSlug: P, status: "PENDING" }, isMember: true })).toMatchObject({ valid: false, reason: "institution_link_unverified" });
    expect(ev({ trial: inst, link: verifiedLink, isMember: false })).toMatchObject({ valid: false, reason: "not_a_member" });
    expect(ev({ trial: inst, link: verifiedLink, isMember: true })).toMatchObject({ valid: true });
  });
  it("a legacy TRIALING subscription is not a trial", () => {
    expect(evaluateSubscriptionSource({ product: P, subscription: { id: "s", productSlug: P, status: "TRIALING" }, periods: [], now: NOW }))
      .toMatchObject({ valid: false, reason: "trial_not_authorized" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("central decision — combining independent sources", () => {
  const paid = (state: LedgerPayment["state"] = "ACTIVE", status: "ACTIVE" | "PAST_DUE" | "CANCELED" = "ACTIVE") =>
    evaluateSubscriptionSource({ product: P, subscription: { id: "sub", productSlug: P, status }, periods: reconstructPeriods([oneOff("A", "2026-10-20T00:00:00Z", "MONTHLY", state)]), now: NOW });
  const lic = (over = {}) => evaluateLicenceSource({ product: P, licence: licence(over), link: verifiedLink, isMember: true, hasActiveSeat: false, now: NOW });
  const opGrant = (valid = true): SourceVerdict => valid
    ? { source: "OPERATOR", sourceId: "og", valid: true, reason: "valid", until: d("2026-11-20T00:00:00Z") }
    : { source: "OPERATOR", sourceId: "og", valid: false, reason: "revoked", until: null };
  const trialV = (valid = true): SourceVerdict => valid
    ? { source: "TRIAL", sourceId: "t", valid: true, reason: "valid", until: d("2026-11-15T00:00:00Z") }
    : { source: "TRIAL", sourceId: "t", valid: false, reason: "expired", until: null };

  it("paid alone grants, with source and until", () => {
    expect(combineEntitlement([paid()])).toMatchObject({ decision: "GRANTED", primary: { source: "SUBSCRIPTION" }, until: d("2026-11-20T00:00:00Z") });
  });

  it("a dispute on a payment does NOT remove a valid institutional licence", () => {
    const r = combineEntitlement([paid("SUSPENDED"), lic()]);
    expect(r).toMatchObject({ decision: "GRANTED", primary: { source: "LICENCE" } });
  });

  it("a dispute does not remove a valid operator grant", () => {
    expect(combineEntitlement([paid("SUSPENDED"), opGrant()])).toMatchObject({ decision: "GRANTED", primary: { source: "OPERATOR" } });
  });

  it("a revoked (lost dispute / full refund) payment does not remove another valid payment's period", () => {
    const periods = reconstructPeriods([oneOff("A", "2026-10-01T00:00:00Z", "MONTHLY", "REVOKED"), oneOff("B", "2026-10-20T00:00:00Z")]);
    const v = evaluateSubscriptionSource({ product: P, subscription: { id: "sub", productSlug: P, status: "ACTIVE" }, periods, now: NOW });
    expect(v).toMatchObject({ valid: true, until: d("2026-11-20T00:00:00Z") });
  });

  it("paid takes precedence over a trial (a trial never masks paid access); access lasts while any source does", () => {
    const r = combineEntitlement([trialV(), paid()]);
    expect(r).toMatchObject({ decision: "GRANTED", primary: { source: "SUBSCRIPTION" }, until: d("2026-11-20T00:00:00Z") });
    expect(combineEntitlement([lic(), paid()])).toMatchObject({ primary: { source: "SUBSCRIPTION" }, until: d("2027-01-01T00:00:00Z") });
  });

  it("every source is reported, valid or not", () => {
    const r = combineEntitlement([paid("SUSPENDED"), lic(), trialV(false), opGrant(false)]);
    expect(r.sources.map((s) => `${s.source}:${s.valid}`)).toEqual(["SUBSCRIPTION:false", "LICENCE:true", "TRIAL:false", "OPERATOR:false"]);
  });

  it.each([
    ["suspended payment alone", () => [paid("SUSPENDED")], "SUSPENDED"],
    ["revoked payment alone", () => [paid("REVOKED")], "REVOKED"],
    ["expired licence alone", () => [lic({ endsAt: d("2026-10-01T00:00:00Z") })], "EXPIRED"],
    ["past-due subscription", () => [paid("ACTIVE", "PAST_DUE")], "DENIED"],
    ["canceled subscription", () => [paid("ACTIVE", "CANCELED")], "DENIED"],
    ["suspended licence + revoked operator grant", () => [lic({ status: "SUSPENDED" }), opGrant(false)], "SUSPENDED"],
    ["no source at all", () => [], "NONE"],
  ] as const)("DENIED when nothing is valid: %s → %s", (_l, build, status) => {
    expect(combineEntitlement(build() as SourceVerdict[])).toMatchObject({ decision: "DENIED", status });
  });

  it("an entitlement for another product never authorizes this one", () => {
    const other = evaluateLicenceSource({ product: P, licence: licence({ productSlug: "scholarsuite" }), link: verifiedLink, isMember: true, hasActiveSeat: false, now: NOW });
    expect(combineEntitlement([other])).toMatchObject({ decision: "DENIED" });
  });
});
