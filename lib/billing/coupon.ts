import type { Coupon } from "@prisma/client";

// FIXED discounts are stored in the same minor-unit currency as the plan
// (cents/kobo); PERCENT is 1-100. Never lets a discount push a price below 0.
export function applyCoupon(
  amountCents: number,
  coupon: Coupon | null
): number {
  if (!coupon) return amountCents;
  if (coupon.discountType === "PERCENT") {
    return Math.max(
      0,
      Math.round(amountCents * (1 - coupon.discountValue / 100))
    );
  }
  return Math.max(0, amountCents - coupon.discountValue);
}
