import type { PlanInterval } from "@prisma/client";
import { addBillingInterval } from "@/lib/billing/paid-period";

/**
 * Payment-to-entitlement period ledger — pure reconstruction (AS-P0-SECURITY-007).
 *
 * NOT WIRED to persistence or to any runtime path yet: the backing tables
 * (entitlement_periods etc.) await migration-governance approval. This module
 * fixes the algorithm so the later persistence layer cannot drift from it.
 *
 * Determinism: the result depends only on the SET of verified payments and
 * their adjudicated states — never on delivery order. Reconstruction runs
 * under the subscription row lock (SELECT … FOR UPDATE) in one transaction.
 */

export type LedgerState = "ACTIVE" | "SUSPENDED" | "REVOKED" | "PENDING_REVIEW";

export type LedgerPayment =
  | {
      kind: "ONE_OFF"; // Paystack / Flutterwave: the plan interval purchased
      invoiceId: string;
      paidAt: Date;
      interval: PlanInterval; // snapshot at purchase time, never the current plan
      state: LedgerState;
    }
  | {
      kind: "PROVIDER_PERIOD"; // Stripe: the provider owns the service period
      invoiceId: string;
      paidAt: Date;
      providerPeriodStart: Date;
      providerPeriodEnd: Date;
      state: LedgerState;
    };

export type ReconstructedPeriod = {
  invoiceId: string;
  state: LedgerState;
  /** null when the period is REVOKED: it occupies no time. */
  periodStart: Date | null;
  periodEnd: Date | null;
  /** Grants access while it covers "now". SUSPENDED and REVOKED never do. */
  entitling: boolean;
};

/** ACTIVE and PENDING_REVIEW (partial refund awaiting review) entitle; SUSPENDED and REVOKED do not. */
export function isEntitlingState(state: LedgerState): boolean {
  return state === "ACTIVE" || state === "PENDING_REVIEW";
}

const byPaymentOrder = (a: LedgerPayment, b: LedgerPayment) =>
  a.paidAt.getTime() - b.paidAt.getTime() || (a.invoiceId < b.invoiceId ? -1 : a.invoiceId > b.invoiceId ? 1 : 0);

/**
 * Rebuilds every period from scratch.
 *
 * One-off payments are folded in payment order with carry-forward:
 *   start = max(paidAt, end of the previous NON-REVOKED period); end = start + interval.
 *   - REVOKED (full refund / lost dispute / reversal): skipped, so it occupies no
 *     time and every later payment slides earlier but keeps its full duration.
 *   - SUSPENDED (open dispute): kept in the chain — its time stays reserved so
 *     later payments do not move into it — but it does not entitle.
 * Provider-period payments (Stripe) keep the provider's own window; REVOKED
 * ones occupy no time. No arithmetic is applied to them.
 */
export function reconstructPeriods(payments: readonly LedgerPayment[]): ReconstructedPeriod[] {
  const seen = new Set<string>();
  for (const p of payments) {
    if (seen.has(p.invoiceId)) throw new Error(`duplicate ledger payment ${p.invoiceId}`);
    seen.add(p.invoiceId);
  }

  const out: ReconstructedPeriod[] = [];
  let cursor: Date | null = null;
  for (const p of [...payments].sort(byPaymentOrder)) {
    if (p.state === "REVOKED") {
      out.push({ invoiceId: p.invoiceId, state: p.state, periodStart: null, periodEnd: null, entitling: false });
      continue;
    }
    if (p.kind === "PROVIDER_PERIOD") {
      out.push({
        invoiceId: p.invoiceId,
        state: p.state,
        periodStart: p.providerPeriodStart,
        periodEnd: p.providerPeriodEnd,
        entitling: isEntitlingState(p.state),
      });
      continue;
    }
    const start: Date = cursor && cursor.getTime() > p.paidAt.getTime() ? cursor : p.paidAt;
    const end = addBillingInterval(start, p.interval);
    cursor = end;
    out.push({ invoiceId: p.invoiceId, state: p.state, periodStart: start, periodEnd: end, entitling: isEntitlingState(p.state) });
  }
  return out;
}

export type Coverage =
  | { entitled: true; until: Date }
  | { entitled: false; reason: "no_periods" | "suspended" | "expired" | "not_started" | "revoked" };

/**
 * Is "now" inside an entitling period? If so, `until` is the end of the
 * CONTIGUOUS run of entitling periods containing now — the value a product
 * session may be capped at. A suspended period ends the run.
 */
export function coverageAt(periods: readonly ReconstructedPeriod[], now: Date): Coverage {
  const timed = periods.filter((p) => p.periodStart && p.periodEnd) as (ReconstructedPeriod & { periodStart: Date; periodEnd: Date })[];
  if (timed.length === 0) {
    return { entitled: false, reason: periods.length ? "revoked" : "no_periods" };
  }
  const t = now.getTime();
  const containing = timed.filter((p) => p.periodStart.getTime() <= t && t < p.periodEnd.getTime());
  const live = containing.find((p) => p.entitling);
  if (!live) {
    if (containing.length) return { entitled: false, reason: "suspended" };
    return { entitled: false, reason: timed.every((p) => p.periodEnd.getTime() <= t) ? "expired" : "not_started" };
  }
  // Extend through back-to-back entitling periods.
  const entitling = timed.filter((p) => p.entitling).sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  let until = live.periodEnd;
  for (const p of entitling) {
    if (p.periodStart.getTime() <= until.getTime() && p.periodEnd.getTime() > until.getTime()) until = p.periodEnd;
  }
  return { entitled: true, until };
}

/** The value cached in Subscription.currentPeriodEnd: the latest end among entitling periods. */
export function latestEntitlingEnd(periods: readonly ReconstructedPeriod[]): Date | null {
  let max: Date | null = null;
  for (const p of periods) {
    if (p.entitling && p.periodEnd && (!max || p.periodEnd.getTime() > max.getTime())) max = p.periodEnd;
  }
  return max;
}
