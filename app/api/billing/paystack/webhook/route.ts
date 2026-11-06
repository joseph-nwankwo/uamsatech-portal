import { NextResponse } from "next/server";
import {
  isPaystackConfigured,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/billing/paystack";
import { logger } from "@/lib/logger";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import type { BillTo } from "@/lib/billing/activate-subscription";
import { recordVerifiedOneTimePayment } from "@/lib/billing/one-time-payment";
import { parseProviderTimestamp } from "@/lib/billing/paid-period";

type PaystackChargeEvent = {
  event: string;
  data: {
    status?: string;
    paid_at?: string | null;
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

  // Only a successful charge can create or extend access. Every other event
  // (including failures, refunds and disputes) is acknowledged and ignored:
  // none of them can move a paid-through date forward.
  if (payload.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const data = payload.data;
  if (data?.status !== "success" || typeof data.reference !== "string" || !data.reference) {
    logger.warn("billing.payment_ignored", { provider: "paystack", reason: "not_successful_or_no_reference" });
    return NextResponse.json({ received: true });
  }

  const { billTo, organizationId, userId, productId, productPlanId, couponId } = data.metadata ?? {};
  const resolvedBillTo: BillTo | null =
    billTo === "organization" && organizationId
      ? { type: "organization", organizationId }
      : billTo === "individual" && userId
        ? { type: "individual", userId }
        : null;

  if (!resolvedBillTo || !productId || !productPlanId) {
    logger.warn("billing.payment_unattributed", { provider: "paystack", reference: data.reference });
    return NextResponse.json({ received: true });
  }

  // Payment time: the signed webhook's paid_at; if absent or unusable, an
  // authenticated provider lookup that must agree on reference, amount and
  // currency. A lookup failure throws → 500 → Paystack retries.
  let paidAt = parseProviderTimestamp(data.paid_at);
  if (!paidAt) {
    const tx = await verifyPaystackTransaction(data.reference);
    const consistent =
      tx.status === "success" &&
      tx.reference === data.reference &&
      tx.amount === data.amount &&
      tx.currency === data.currency;
    paidAt = consistent ? parseProviderTimestamp(tx.paid_at ?? tx.paidAt) : null;
  }
  if (!paidAt) {
    // Never invent a date. Logged for manual reconciliation; no write.
    logger.error("billing.paid_at_unavailable", { provider: "paystack", reference: data.reference });
    return NextResponse.json({ received: true });
  }

  const result = await recordVerifiedOneTimePayment({
    provider: "PAYSTACK",
    reference: data.reference,
    paidAt,
    amountCents: data.amount,
    currency: data.currency,
    billTo: resolvedBillTo,
    productId,
    productPlanId,
    couponId,
    providerCustomerId: data.customer.customer_code,
  });

  logger.info("billing.payment_processed", {
    provider: "paystack",
    reference: data.reference,
    outcome: result.outcome,
    ...(result.outcome === "rejected" ? { reason: result.reason } : {}),
    ...(result.outcome === "recorded" ? { mode: result.mode } : {}),
  });

  return NextResponse.json({ received: true });
}
