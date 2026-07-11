import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import {
  verifyStripeWebhookSignature,
  isStripeConfigured,
} from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import {
  upsertSubscriptionFromCheckout,
  type BillTo,
} from "@/lib/billing/activate-subscription";
import type { SubscriptionStatus } from "@prisma/client";

function mapStripeStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    default:
      return "CANCELED";
  }
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  // Signature verification is the real defense here — this is just
  // defense-in-depth against resource exhaustion from repeated invalid
  // requests. Sized generously so real webhook bursts never hit it.
  const { allowed } = await checkRateLimit(
    `webhook:stripe:${requestIp(request)}`,
    100,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhookSignature(rawBody, signature);
  } catch {
    logger.warn("webhook.invalid_signature", { provider: "stripe" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  logger.info("webhook.received", { provider: "stripe", event: event.type });

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const {
        billTo,
        organizationId,
        userId,
        productId,
        productPlanId,
        couponId,
      } = checkoutSession.metadata ?? {};

      const resolvedBillTo: BillTo | null =
        billTo === "organization" && organizationId
          ? { type: "organization", organizationId }
          : billTo === "individual" && userId
            ? { type: "individual", userId }
            : null;

      if (
        resolvedBillTo &&
        productId &&
        productPlanId &&
        checkoutSession.subscription
      ) {
        await upsertSubscriptionFromCheckout({
          billTo: resolvedBillTo,
          productId,
          productPlanId,
          couponId,
          provider: "STRIPE",
          providerCustomerId: String(checkoutSession.customer),
          providerSubscriptionId: String(checkoutSession.subscription),
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const status: SubscriptionStatus =
        event.type === "customer.subscription.deleted"
          ? "CANCELED"
          : mapStripeStatus(stripeSub.status);

      await db.subscription.updateMany({
        where: { providerSubscriptionId: stripeSub.id },
        data: {
          status,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
      });
      break;
    }

    case "invoice.paid": {
      const stripeInvoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof stripeInvoice.parent?.subscription_details?.subscription ===
        "string"
          ? stripeInvoice.parent.subscription_details.subscription
          : null;

      if (subscriptionId) {
        const subscription = await db.subscription.findFirst({
          where: { providerSubscriptionId: subscriptionId },
        });

        if (subscription) {
          await db.invoice.create({
            data: {
              subscriptionId: subscription.id,
              organizationId: subscription.organizationId,
              userId: subscription.userId,
              amountCents: stripeInvoice.amount_paid,
              currency: stripeInvoice.currency.toUpperCase(),
              status: "PAID",
              provider: "STRIPE",
              providerInvoiceId: stripeInvoice.id,
              hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? null,
              periodStart: new Date(stripeInvoice.period_start * 1000),
              periodEnd: new Date(stripeInvoice.period_end * 1000),
              paidAt: new Date(),
            },
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
