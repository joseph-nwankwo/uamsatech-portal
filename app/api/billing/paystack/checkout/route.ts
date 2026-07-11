import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { env } from "@/lib/env";
import {
  initializePaystackTransaction,
  isPaystackConfigured,
} from "@/lib/billing/paystack";
import { resolveCheckoutContext } from "@/lib/billing/checkout-context";
import { applyCouponDiscount } from "@/lib/billing/coupons";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const bodySchema = z.object({
  productPlanId: z.string(),
  couponCode: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  if (!isPaystackConfigured()) {
    return NextResponse.json(
      { error: "Paystack is not configured yet." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const ctx = await resolveCheckoutContext(
    parsed.data.productPlanId,
    parsed.data.couponCode
  );
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: 400 });
  }
  const { session, billTo, productPlan, user, coupon } = ctx;

  const { allowed } = await checkRateLimit(
    `checkout:${session.sub}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Try again later." },
      { status: 429 }
    );
  }

  const reference = `psk_${randomUUID()}`;

  const result = await initializePaystackTransaction({
    email: user.email,
    amountKobo: coupon
      ? applyCouponDiscount(productPlan.priceCents, coupon)
      : productPlan.priceCents,
    reference,
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/portal/billing?checkout=success`,
    metadata: {
      billTo: billTo.type,
      ...(billTo.type === "organization"
        ? { organizationId: billTo.organizationId }
        : { userId: user.id }),
      productId: productPlan.productId,
      productPlanId: productPlan.id,
      ...(coupon ? { couponId: coupon.id } : {}),
    },
  });

  await logActivity(session.sub, "billing.checkout_started", {
    provider: "PAYSTACK",
    productPlanId: productPlan.id,
    reference,
  });

  return NextResponse.json({ url: result.data.authorization_url });
}
