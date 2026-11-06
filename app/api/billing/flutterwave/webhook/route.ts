import { NextResponse } from "next/server";
import {
  isFlutterwaveConfigured,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookSignature,
} from "@/lib/billing/flutterwave";
import { logger } from "@/lib/logger";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import type { BillTo } from "@/lib/billing/activate-subscription";
import { recordVerifiedOneTimePayment } from "@/lib/billing/one-time-payment";
import { parseProviderTimestamp } from "@/lib/billing/paid-period";

type FlutterwaveEvent = {
  event: string;
  data: { id: number; status: string };
};

export async function POST(request: Request) {
  if (!isFlutterwaveConfigured()) {
    return NextResponse.json(
      { error: "Flutterwave is not configured." },
      { status: 503 }
    );
  }

  const { allowed } = await checkRateLimit(
    `webhook:flutterwave:${requestIp(request)}`,
    100,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const signature = request.headers.get("verif-hash");
  if (!verifyFlutterwaveWebhookSignature(signature)) {
    logger.warn("webhook.invalid_signature", { provider: "flutterwave" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = JSON.parse(await request.text()) as FlutterwaveEvent;
  logger.info("webhook.received", {
    provider: "flutterwave",
    event: payload.event,
  });

  // Only a completed charge can create or extend access. Every other event
  // (including refunds) is acknowledged and ignored: none of them can move a
  // paid-through date forward.
  if (payload.event !== "charge.completed") {
    return NextResponse.json({ received: true });
  }

  const transactionId = payload.data?.id;
  if (typeof transactionId !== "number" || !Number.isSafeInteger(transactionId)) {
    logger.warn("billing.payment_ignored", { provider: "flutterwave", reason: "no_transaction_id" });
    return NextResponse.json({ received: true });
  }

  // Re-verify server-side rather than trusting the webhook body directly.
  // A lookup failure throws → 500 → Flutterwave retries.
  const verified = await verifyFlutterwaveTransaction(String(transactionId));
  const v = verified.data;

  if (
    verified.status !== "success" ||
    v?.status !== "successful" ||
    v.id !== transactionId ||
    typeof v.tx_ref !== "string" ||
    !v.tx_ref
  ) {
    logger.warn("billing.payment_ignored", { provider: "flutterwave", reason: "not_verified_successful" });
    return NextResponse.json({ received: true });
  }

  const { billTo, organizationId, userId, productId, productPlanId, couponId } = v.meta ?? {};
  const resolvedBillTo: BillTo | null =
    billTo === "organization" && organizationId
      ? { type: "organization", organizationId }
      : billTo === "individual" && userId
        ? { type: "individual", userId }
        : null;

  if (!resolvedBillTo || !productId || !productPlanId) {
    logger.warn("billing.payment_unattributed", { provider: "flutterwave", reference: v.tx_ref });
    return NextResponse.json({ received: true });
  }

  const paidAt = parseProviderTimestamp(v.created_at);
  if (!paidAt) {
    // Never invent a date. Logged for manual reconciliation; no write.
    logger.error("billing.paid_at_unavailable", { provider: "flutterwave", reference: v.tx_ref });
    return NextResponse.json({ received: true });
  }

  const result = await recordVerifiedOneTimePayment({
    provider: "FLUTTERWAVE",
    reference: v.tx_ref,
    paidAt,
    amountCents: Math.round(v.amount * 100),
    currency: v.currency,
    billTo: resolvedBillTo,
    productId,
    productPlanId,
    couponId,
    providerCustomerId: v.customer.email,
  });

  logger.info("billing.payment_processed", {
    provider: "flutterwave",
    reference: v.tx_ref,
    outcome: result.outcome,
    ...(result.outcome === "rejected" ? { reason: result.reason } : {}),
    ...(result.outcome === "recorded" ? { mode: result.mode } : {}),
  });

  return NextResponse.json({ received: true });
}
