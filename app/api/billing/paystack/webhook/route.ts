import { NextResponse } from "next/server";
import {
  isPaystackConfigured,
  verifyPaystackWebhookSignature,
} from "@/lib/billing/paystack";
import { logger } from "@/lib/logger";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import {
  upsertSubscriptionFromCheckout,
  createInvoiceForSubscription,
  type BillTo,
} from "@/lib/billing/activate-subscription";

type PaystackChargeEvent = {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    customer: { customer_code: string };
    metadata?: {
      billTo?: string;
      organizationId?: string;
      userId?: string;
      productId?: string;
      productPlanId?: string;
      couponId?: string;
    };
  };
};

export async function POST(request: Request) {
  if (!isPaystackConfigured()) {
    return NextResponse.json(
      { error: "Paystack is not configured." },
      { status: 503 }
    );
  }

  const { allowed } = await checkRateLimit(
    `webhook:paystack:${requestIp(request)}`,
    100,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    logger.warn("webhook.invalid_signature", { provider: "paystack" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as PaystackChargeEvent;
  logger.info("webhook.received", {
    provider: "paystack",
    event: payload.event,
  });

  if (payload.event === "charge.success") {
    const {
      billTo,
      organizationId,
      userId,
      productId,
      productPlanId,
      couponId,
    } = payload.data.metadata ?? {};

    const resolvedBillTo: BillTo | null =
      billTo === "organization" && organizationId
        ? { type: "organization", organizationId }
        : billTo === "individual" && userId
          ? { type: "individual", userId }
          : null;

    if (resolvedBillTo && productId && productPlanId) {
      const subscription = await upsertSubscriptionFromCheckout({
        billTo: resolvedBillTo,
        productId,
        productPlanId,
        couponId,
        provider: "PAYSTACK",
        providerCustomerId: payload.data.customer.customer_code,
        providerSubscriptionId: payload.data.reference,
      });

      await createInvoiceForSubscription(subscription, {
        amountCents: payload.data.amount,
        currency: payload.data.currency,
        provider: "PAYSTACK",
        providerInvoiceId: payload.data.reference,
      });
    }
  }

  return NextResponse.json({ received: true });
}
