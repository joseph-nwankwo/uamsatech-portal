import type { BillingProvider } from "@prisma/client";
import type { LedgerState } from "@/lib/billing/domain/period-ledger";

/**
 * Refund and dispute adjudication — pure (AS-P0-SECURITY-007). NOT WIRED yet.
 *
 * A payment's ledger state is DERIVED from the full set of VERIFIED
 * adjustments recorded against it, rather than mutated event-by-event. This
 * makes duplicate deliveries and out-of-order events harmless by
 * construction: the same evidence always yields the same state.
 *
 * Approved policy (AS-P0-SECURITY-006 §2 / 007 §1.6):
 *   full refund / verified reversal → REVOKED      partial refund → PENDING_REVIEW
 *   dispute open / under review     → SUSPENDED    dispute won / closed → (restored)
 *   dispute lost                    → REVOKED      failed/canceled refund → no effect
 *   unverified evidence             → ignored      Stripe renewal refunded → PENDING_REVIEW
 */

export type RefundStatus = "REQUESTED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "REVERSED";
export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "WON" | "LOST" | "CLOSED" | "UNKNOWN";

export type RefundRecord = {
  provider: BillingProvider;
  providerRefundId: string;
  amountCents: number;
  currency: string;
  status: RefundStatus;
  providerUpdatedAt: Date;
  verified: boolean;
};

export type DisputeRecord = {
  provider: BillingProvider;
  providerDisputeId: string;
  status: DisputeStatus;
  providerUpdatedAt: Date;
  verified: boolean;
};

const key = (provider: string, id: string) => `${provider}\u0000${id}`;

/** Keeps the latest verified version of each provider-scoped record; unverified records are dropped. */
function latestVerified<T extends { provider: BillingProvider; providerUpdatedAt: Date; verified: boolean }>(
  records: readonly T[],
  idOf: (r: T) => string
): T[] {
  const latest = new Map<string, T>();
  for (const r of records) {
    if (!r.verified) continue;
    const k = key(r.provider, idOf(r));
    const prev = latest.get(k);
    if (!prev || r.providerUpdatedAt.getTime() >= prev.providerUpdatedAt.getTime()) latest.set(k, r);
  }
  return [...latest.values()];
}

// ── Refund lifecycle ──────────────────────────────────────────────────────────

const REFUND_TERMINAL: ReadonlySet<RefundStatus> = new Set(["FAILED", "CANCELED", "REVERSED"]);

/**
 * Allowed status move for ONE refund record when a newer verified event
 * arrives. Older events (by provider timestamp) never regress a record.
 * SUCCEEDED may only move to REVERSED (provider evidence that the refund was
 * undone); other terminal states are final.
 */
export function nextRefundStatus(
  current: { status: RefundStatus; providerUpdatedAt: Date } | null,
  incoming: { status: RefundStatus; providerUpdatedAt: Date }
): RefundStatus {
  if (!current) return incoming.status;
  if (incoming.providerUpdatedAt.getTime() < current.providerUpdatedAt.getTime()) return current.status;
  if (REFUND_TERMINAL.has(current.status)) return current.status;
  if (current.status === "SUCCEEDED") return incoming.status === "REVERSED" ? "REVERSED" : "SUCCEEDED";
  return incoming.status;
}

export type RefundSummary = {
  /** Sum of distinct, verified, SUCCEEDED refunds. A REVERSED refund no longer counts. */
  refundedCents: number;
  classification: "NONE" | "PARTIAL" | "FULL";
  /** Refunds in another currency cannot be compared to the payment: manual review. */
  currencyMismatch: boolean;
};

export function summarizeRefunds(
  payment: { amountCents: number; currency: string },
  refunds: readonly RefundRecord[]
): RefundSummary {
  let refundedCents = 0;
  let currencyMismatch = false;
  for (const r of latestVerified(refunds, (x) => x.providerRefundId)) {
    if (r.status !== "SUCCEEDED") continue;
    if (r.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      currencyMismatch = true;
      continue;
    }
    refundedCents += r.amountCents;
  }
  const classification = refundedCents <= 0 ? "NONE" : refundedCents >= payment.amountCents ? "FULL" : "PARTIAL";
  return { refundedCents, classification, currencyMismatch };
}

// ── Dispute lifecycle ─────────────────────────────────────────────────────────

/**
 * Provider status → normalised lifecycle. Stripe values are verified against
 * stripe@22 types (Dispute.Status). Paystack and Flutterwave dispute status
 * vocabularies are NOT yet verified against live payloads (MISSING EVIDENCE):
 * anything unmapped becomes UNKNOWN, which changes no entitlement and must be
 * routed to manual review.
 */
const DISPUTE_STATUS_MAP: Partial<Record<BillingProvider, Record<string, DisputeStatus>>> = {
  STRIPE: {
    needs_response: "OPEN",
    warning_needs_response: "OPEN",
    under_review: "UNDER_REVIEW",
    warning_under_review: "UNDER_REVIEW",
    won: "WON",
    lost: "LOST",
    warning_closed: "CLOSED",
    prevented: "CLOSED",
  },
};

export function normalizeDisputeStatus(provider: BillingProvider, providerStatus: string): DisputeStatus {
  return DISPUTE_STATUS_MAP[provider]?.[providerStatus] ?? "UNKNOWN";
}

const DISPUTE_TERMINAL: ReadonlySet<DisputeStatus> = new Set(["WON", "LOST", "CLOSED"]);

/** Same discipline as refunds: older events never regress; resolutions are final. */
export function nextDisputeStatus(
  current: { status: DisputeStatus; providerUpdatedAt: Date } | null,
  incoming: { status: DisputeStatus; providerUpdatedAt: Date }
): DisputeStatus {
  if (incoming.status === "UNKNOWN") return current?.status ?? "UNKNOWN";
  if (!current) return incoming.status;
  if (incoming.providerUpdatedAt.getTime() < current.providerUpdatedAt.getTime()) return current.status;
  if (DISPUTE_TERMINAL.has(current.status)) return current.status;
  return incoming.status;
}

// ── Payment state ─────────────────────────────────────────────────────────────

export type PaymentAdjudication = {
  state: LedgerState;
  reason: "none" | "full_refund" | "partial_refund" | "dispute_open" | "dispute_lost" | "renewal_refund_review" | "currency_review";
};

/**
 * The ledger state of ONE payment from all of its verified adjustments.
 * Precedence: REVOKED > SUSPENDED > PENDING_REVIEW > ACTIVE. It only ever
 * concerns this payment; other payments, products and entitlement sources are
 * never touched.
 */
export function adjudicatePayment(input: {
  payment: { amountCents: number; currency: string; kind: "ONE_OFF" | "PROVIDER_PERIOD" };
  refunds: readonly RefundRecord[];
  disputes: readonly DisputeRecord[];
}): PaymentAdjudication {
  const disputes = latestVerified(input.disputes, (d) => d.providerDisputeId);
  if (disputes.some((d) => d.status === "LOST")) return { state: "REVOKED", reason: "dispute_lost" };

  const refunds = summarizeRefunds(input.payment, input.refunds);
  if (refunds.classification === "FULL") {
    // Approved policy: a refunded Stripe renewal invoice is manual review,
    // never an automatic revocation or subscription cancellation.
    return input.payment.kind === "PROVIDER_PERIOD"
      ? { state: "PENDING_REVIEW", reason: "renewal_refund_review" }
      : { state: "REVOKED", reason: "full_refund" };
  }

  if (disputes.some((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW")) {
    return { state: "SUSPENDED", reason: "dispute_open" };
  }
  if (refunds.classification === "PARTIAL") return { state: "PENDING_REVIEW", reason: "partial_refund" };
  if (refunds.currencyMismatch) return { state: "PENDING_REVIEW", reason: "currency_review" };
  return { state: "ACTIVE", reason: "none" };
}

/** A verified payment reversal is treated exactly as a full refund (approved policy). */
export function reversalAsRefund(r: {
  provider: BillingProvider;
  providerReversalId: string;
  amountCents: number;
  currency: string;
  providerUpdatedAt: Date;
  verified: boolean;
}): RefundRecord {
  return {
    provider: r.provider,
    providerRefundId: `reversal:${r.providerReversalId}`,
    amountCents: r.amountCents,
    currency: r.currency,
    status: "SUCCEEDED",
    providerUpdatedAt: r.providerUpdatedAt,
    verified: r.verified,
  };
}
