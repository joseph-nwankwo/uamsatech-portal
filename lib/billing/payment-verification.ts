import type { Coupon } from "@prisma/client";
import { applyCouponDiscount } from "@/lib/billing/coupons";

/**
 * Expected charge for a one-time Paystack/Flutterwave checkout
 * (AS-P0-SECURITY-005, payment amount verification).
 *
 * Mirrors exactly what the checkout routes ask the provider to charge: the
 * plan's own priceCents in the plan's own currency, less the coupon the
 * checkout applied (lib/billing/coupons.ts). No price is hard-coded; every
 * plan is checked against its own stored price and currency.
 */
export function expectedOneTimeCharge(
  plan: { priceCents: number; currency: string },
  coupon: Coupon | null
): { amountCents: number; currency: string } {
  return {
    amountCents: coupon ? applyCouponDiscount(plan.priceCents, coupon) : plan.priceCents,
    currency: plan.currency.toUpperCase(),
  };
}

export type ChargeCheck =
  | { ok: true }
  | { ok: false; reason: "currency_mismatch" | "amount_mismatch"; expected: { amountCents: number; currency: string } };

/** A successful status is not enough: amount and currency must match exactly. */
export function checkCharge(
  actual: { amountCents: number; currency: string },
  expected: { amountCents: number; currency: string }
): ChargeCheck {
  if (actual.currency.toUpperCase() !== expected.currency) {
    return { ok: false, reason: "currency_mismatch", expected };
  }
  if (!Number.isSafeInteger(actual.amountCents) || actual.amountCents !== expected.amountCents) {
    return { ok: false, reason: "amount_mismatch", expected };
  }
  return { ok: true };
}
