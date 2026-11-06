import type { BillingProvider, PlanInterval, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics/track";
import { upsertSubscriptionFromCheckout, type BillTo } from "@/lib/billing/activate-subscription";
import { addBillingInterval } from "@/lib/billing/paid-period";
import { checkCharge, expectedOneTimeCharge } from "@/lib/billing/payment-verification";

/**
 * Records one provider-verified, successful one-time payment (Paystack or
 * Flutterwave) and advances the subscription's paid-through date.
 *
 * AS-P0-SECURITY-004 guarantees, kept:
 * - Idempotent on the provider reference, including concurrent duplicates.
 *   AS-P0-SECURITY-007B (D7): uniqueness is provider-scoped —
 *   @@unique([provider, providerInvoiceId]) — so a reference is only a
 *   duplicate of an invoice from the SAME provider.
 * - Atomic: everything commits together or not at all.
 * - Never shortens currentPeriodEnd; never invents a date.
 *
 * AS-P0-SECURITY-005 additions:
 * - Carry-forward (approved early-renewal policy): a payment made while the
 *   subscription is still paid-through starts immediately after that date;
 *   otherwise it starts at the verified payment time.
 * - Concurrency: the subscription row is locked (SELECT … FOR UPDATE) so two
 *   different payments processed at once both count.
 * - Out-of-order: a payment older than ones already recorded is slotted into
 *   the chain by payment time and the later invoices are re-slotted, so the
 *   result does not depend on delivery order. If a later invoice's period
 *   length cannot be determined, nothing is extended and the payment is
 *   flagged for manual review rather than guessed.
 * - Amount verification: provider-confirmed amount and currency must equal
 *   the plan's price (less the checkout's coupon) in the plan's currency;
 *   the plan must belong to the product; the payer must exist.
 * - Audit: every extension, review flag and rejection writes an AuditLog
 *   entry in the same transaction.
 */

export const BILLING_AUDIT = {
  extended: "billing.entitlement_extended",
  needsReview: "billing.renewal_needs_review",
  rejected: "billing.payment_rejected",
} as const;

export type VerifiedOneTimePayment = {
  provider: Extract<BillingProvider, "PAYSTACK" | "FLUTTERWAVE">;
  /** Provider transaction reference, unique per payment. */
  reference: string;
  /** Provider-confirmed time the payment succeeded (UTC). */
  paidAt: Date;
  /** Provider-confirmed amount, in the currency's minor unit. */
  amountCents: number;
  /** Provider-confirmed currency. */
  currency: string;
  billTo: BillTo;
  productId: string;
  productPlanId: string;
  couponId?: string;
  providerCustomerId: string;
};

export type RejectReason =
  | "plan_not_found"
  | "plan_product_mismatch"
  | "attribution_not_found"
  | "coupon_not_found"
  | "currency_mismatch"
  | "amount_mismatch";

export type RenewalMode = "new_period" | "carried_forward" | "recomputed" | "needs_review";

export type RecordPaymentResult =
  | {
      outcome: "recorded";
      subscriptionId: string;
      mode: RenewalMode;
      periodStart: Date;
      periodEnd: Date;
      currentPeriodEnd: Date | null;
    }
  | { outcome: "duplicate" }
  | { outcome: "rejected"; reason: RejectReason };

type Tx = Prisma.TransactionClient;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

const later = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

/** The plan interval an invoice's stored period spans exactly, if any. */
export function intervalOfPeriod(start: Date, end: Date): PlanInterval | null {
  for (const interval of ["MONTHLY", "YEARLY"] as const) {
    if (addBillingInterval(start, interval).getTime() === end.getTime()) return interval;
  }
  return null;
}

function auditIdentity(billTo: BillTo) {
  return billTo.type === "organization"
    ? { userId: null, organizationId: billTo.organizationId }
    : { userId: billTo.userId, organizationId: null };
}

async function reject(tx: Tx, input: VerifiedOneTimePayment, reason: RejectReason, detail?: Prisma.InputJsonObject) {
  await tx.auditLog.create({
    data: {
      ...auditIdentity(input.billTo),
      action: BILLING_AUDIT.rejected,
      metadata: {
        provider: input.provider,
        reference: input.reference,
        reason,
        productId: input.productId,
        productPlanId: input.productPlanId,
        actual: { amountCents: input.amountCents, currency: input.currency },
        ...(detail ?? {}),
      },
    },
  });
  return { outcome: "rejected", reason } as const;
}

export async function recordVerifiedOneTimePayment(
  input: VerifiedOneTimePayment
): Promise<RecordPaymentResult> {
  let result: RecordPaymentResult;
  try {
    result = await db.$transaction(async (tx) => {
      // 1. Idempotency
      const already = await tx.invoice.findUnique({
        where: { provider_providerInvoiceId: { provider: input.provider, providerInvoiceId: input.reference } },
        select: { id: true },
      });
      if (already) return { outcome: "duplicate" } as const;

      // 2. Plan ↔ product, payer, coupon, amount, currency
      const plan = await tx.productPlan.findUnique({
        where: { id: input.productPlanId },
        select: { productId: true, interval: true, priceCents: true, currency: true },
      });
      if (!plan) return reject(tx, input, "plan_not_found");
      if (plan.productId !== input.productId) return reject(tx, input, "plan_product_mismatch");

      const payerExists =
        input.billTo.type === "organization"
          ? await tx.organization.findUnique({ where: { id: input.billTo.organizationId }, select: { id: true } })
          : await tx.user.findUnique({ where: { id: input.billTo.userId }, select: { id: true } });
      if (!payerExists) return reject(tx, input, "attribution_not_found");

      const coupon = input.couponId ? await tx.coupon.findUnique({ where: { id: input.couponId } }) : null;
      if (input.couponId && !coupon) return reject(tx, input, "coupon_not_found");

      const expected = expectedOneTimeCharge(plan, coupon);
      const charge = checkCharge({ amountCents: input.amountCents, currency: input.currency }, expected);
      if (!charge.ok) {
        return reject(tx, input, charge.reason, { expected: charge.expected });
      }

      // 3. Lock the subscription row (if any) and read it fresh
      const where =
        input.billTo.type === "organization"
          ? { organizationId_productId: { organizationId: input.billTo.organizationId, productId: input.productId } }
          : { userId_productId: { userId: input.billTo.userId, productId: input.productId } };
      const existing = await tx.subscription.findUnique({ where, select: { id: true } });
      if (existing) {
        await tx.$queryRaw`SELECT id FROM subscriptions WHERE id = ${existing.id} FOR UPDATE`;
      }
      const current = existing ? await tx.subscription.findUnique({ where: { id: existing.id } }) : null;
      const previousEnd = current?.currentPeriodEnd ?? null;

      // 4. Place this payment's period
      const laterPayments = current
        ? await tx.invoice.findMany({
            where: { subscriptionId: current.id, status: "PAID", paidAt: { gt: input.paidAt } },
            orderBy: { paidAt: "asc" },
            select: { id: true, paidAt: true, periodStart: true, periodEnd: true },
          })
        : [];

      let mode: RenewalMode;
      let periodStart: Date;
      let periodEnd: Date;
      let newEnd: Date | null;
      const reslot: { id: string; periodStart: Date; periodEnd: Date }[] = [];

      if (laterPayments.length === 0) {
        // In order: carry forward from a still-valid paid-through date.
        const carry = previousEnd !== null && previousEnd.getTime() > input.paidAt.getTime();
        periodStart = carry ? previousEnd : input.paidAt;
        periodEnd = addBillingInterval(periodStart, plan.interval);
        newEnd = periodEnd;
        mode = carry ? "carried_forward" : "new_period";
      } else {
        // Out of order: slot by payment time, then re-slot every later payment.
        const intervals = laterPayments.map((p) => intervalOfPeriod(p.periodStart, p.periodEnd));
        if (intervals.some((i) => i === null) || laterPayments.some((p) => p.paidAt === null)) {
          periodStart = input.paidAt;
          periodEnd = addBillingInterval(input.paidAt, plan.interval);
          newEnd = null; // do not extend on a chain we cannot rebuild exactly
          mode = "needs_review";
        } else {
          const prior = await tx.invoice.findFirst({
            where: { subscriptionId: current!.id, status: "PAID", paidAt: { lte: input.paidAt } },
            orderBy: { paidAt: "desc" },
            select: { periodEnd: true },
          });
          let cursor = prior ? later(prior.periodEnd, input.paidAt) : input.paidAt;
          periodStart = cursor;
          periodEnd = addBillingInterval(cursor, plan.interval);
          cursor = periodEnd;
          laterPayments.forEach((p, i) => {
            const start = later(p.paidAt!, cursor);
            const end = addBillingInterval(start, intervals[i]!);
            reslot.push({ id: p.id, periodStart: start, periodEnd: end });
            cursor = end;
          });
          newEnd = cursor;
          mode = "recomputed";
        }
      }

      // 5. Subscription: plan/status/reference follow the NEWEST payment only
      let subscriptionId: string;
      if (laterPayments.length === 0) {
        const sub = await upsertSubscriptionFromCheckout(
          {
            billTo: input.billTo,
            productId: input.productId,
            productPlanId: input.productPlanId,
            couponId: input.couponId,
            provider: input.provider,
            providerCustomerId: input.providerCustomerId,
            providerSubscriptionId: input.reference,
          },
          tx,
          { emitEvent: false }
        );
        subscriptionId = sub.id;
      } else {
        subscriptionId = current!.id;
      }

      if (newEnd) {
        // Never shortens: matches only when the stored date is earlier.
        await tx.subscription.updateMany({
          where: { id: subscriptionId, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { lt: newEnd } }] },
          data: { currentPeriodEnd: newEnd },
        });
      }
      for (const r of reslot) {
        await tx.invoice.update({ where: { id: r.id }, data: { periodStart: r.periodStart, periodEnd: r.periodEnd } });
      }

      await tx.invoice.create({
        data: {
          subscriptionId,
          organizationId: input.billTo.type === "organization" ? input.billTo.organizationId : null,
          userId: input.billTo.type === "individual" ? input.billTo.userId : null,
          amountCents: input.amountCents,
          currency: input.currency.toUpperCase(),
          status: "PAID",
          provider: input.provider,
          providerInvoiceId: input.reference,
          periodStart,
          periodEnd,
          paidAt: input.paidAt,
        },
      });

      const after = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        select: { currentPeriodEnd: true },
      });
      const currentPeriodEnd = after?.currentPeriodEnd ?? null;

      await tx.auditLog.create({
        data: {
          ...auditIdentity(input.billTo),
          action: mode === "needs_review" ? BILLING_AUDIT.needsReview : BILLING_AUDIT.extended,
          metadata: {
            provider: input.provider,
            reference: input.reference,
            subscriptionId,
            mode,
            paidAt: input.paidAt.toISOString(),
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            previousCurrentPeriodEnd: previousEnd?.toISOString() ?? null,
            currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
            reslotted: reslot.length,
          },
        },
      });

      return { outcome: "recorded", subscriptionId, mode, periodStart, periodEnd, currentPeriodEnd } as const;
    });
  } catch (err) {
    // A concurrent delivery of the same reference may have committed first.
    // Only call it a duplicate if that reference is now actually recorded.
    if (isUniqueViolation(err)) {
      const committed = await db.invoice.findUnique({
        where: { provider_providerInvoiceId: { provider: input.provider, providerInvoiceId: input.reference } },
        select: { id: true },
      });
      if (committed) return { outcome: "duplicate" };
    }
    throw err;
  }

  if (result.outcome === "recorded" && result.mode === "new_period") {
    await trackEvent("subscription_created", {
      organizationId: input.billTo.type === "organization" ? input.billTo.organizationId : undefined,
      metadata: { productId: input.productId, provider: input.provider, billTo: input.billTo.type },
    }).catch(() => undefined); // analytics must never fail a recorded payment
  }
  return result;
}
