import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe";
import { resolveCheckoutContext } from "@/lib/billing/checkout-context";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const bodySchema = z.object({
  productPlanId: z.string(),
  couponCode: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured yet." },
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

  // Each call here creates a real checkout session with a real payment
  // provider — worth limiting independently of the provider's own limits.
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

  if (!productPlan.stripePriceId) {
    return NextResponse.json(
      { error: "This plan isn't available via Stripe yet." },
      { status: 400 }
    );
  }

  // Stripe subscriptions bill at their fixed `price` — a coupon can only be
  // applied via Stripe's own Coupon object, not by recomputing the amount.
  if (coupon && !coupon.stripeCouponId) {
    return NextResponse.json(
      {
        error:
          "This coupon isn't available for Stripe. Try another payment method.",
      },
      { status: 400 }
    );
  }

  const stripe = getStripeClient();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: productPlan.stripePriceId, quantity: 1 }],
    ...(coupon?.stripeCouponId
      ? { discounts: [{ coupon: coupon.stripeCouponId }] }
      : {}),
    customer_email: user.email,
    success_url: `${env.NEXT_PUBLIC_APP_URL}/portal/billing?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/portal/billing?checkout=canceled`,
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
    provider: "STRIPE",
    productPlanId: productPlan.id,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
