import { db } from "@/lib/db";
import type { Coupon } from "@prisma/client";

export async function validateCoupon(code: string): Promise<Coupon | null> {
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) return null;

  const now = new Date();
  if (coupon.validFrom > now) return null;
  if (coupon.validUntil && coupon.validUntil < now) return null;
  if (
    coupon.maxRedemptions !== null &&
    coupon.timesRedeemed >= coupon.maxRedemptions
  ) {
    return null;
  }

  return coupon;
}

export function applyCouponDiscount(
  priceCents: number,
  coupon: Coupon
): number {
  if (coupon.discountType === "PERCENT") {
    return Math.round(priceCents * (1 - coupon.discountValue / 100));
  }
  return Math.max(0, priceCents - coupon.discountValue);
}
