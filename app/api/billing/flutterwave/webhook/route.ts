import { NextResponse } from "next/server";
import {
  isFlutterwaveConfigured,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookSignature,
} from "@/lib/billing/flutterwave";
import { logger } from "@/lib/logger";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import {
  upsertSubscriptionFromCheckout,
  createInvoiceForSubscription,
  type BillTo,
} from "@/lib/billing/activate-subscription";

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

  if (payload.event === "charge.completed") {
    // Re-verify server-side rather than trusting the webhook body directly.
    const verified = await verifyFlutterwaveTransaction(
      String(payload.data.id)
    );

    if (verified.data.status === "successful") {
      const {
        billTo,
        organizationId,
        userId,
        productId,
        productPlanId,
        couponId,
      } = verified.data.meta ?? {};

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
          provider: "FLUTTERWAVE",
          providerCustomerId: verified.data.customer.email,
          providerSubscriptionId: verified.data.tx_ref,
        });

        await createInvoiceForSubscription(subscription, {
          amountCents: Math.round(verified.data.amount * 100),
          currency: verified.data.currency,
          provider: "FLUTTERWAVE",
          providerInvoiceId: verified.data.tx_ref,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
