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
import { syncStripeSubscription } from "@/lib/billing/stripe-sync";

/**
 * Stripe webhook (AS-P0-SECURITY-005).
 *
 * Signature verification is unchanged. After it, no entitlement-relevant
 * field is taken from the event payload: every subscription-related event
 * re-fetches the subscription from the Stripe API (lib/billing/stripe-sync.ts),
 * which makes duplicate and out-of-order delivery harmless. Stripe/API or
 * database failures throw → 500 → Stripe retries.
 */

/** Events whose only job is to re-sync the subscription from Stripe. */
const SYNC_EVENTS = new Set<string>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.payment_failed",
  "invoice.payment_action_required",
]);

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription ?? null);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

/** Idempotent payment-history record for a paid Stripe invoice. Entitlement comes from the sync, not from this. */
async function recordStripeInvoice(invoice: Stripe.Invoice, stripeSubscriptionId: string): Promise<string> {
  const paidAtUnix = invoice.status_transitions?.paid_at ?? null;
  if (invoice.status !== "paid" || typeof paidAtUnix !== "number") return "not_paid";

  const local = await db.subscription.findFirst({
    where: { provider: "STRIPE", providerSubscriptionId: stripeSubscriptionId },
    select: { id: true, organizationId: true, userId: true },
  });
  if (!local) return "unknown_subscription";

  // D7 (AS-P0-SECURITY-007B): invoice identifiers are unique per provider.
  const existing = await db.invoice.findUnique({
    where: { provider_providerInvoiceId: { provider: "STRIPE", providerInvoiceId: invoice.id } },
    select: { id: true },
  });
  if (existing) return "duplicate";

  // The service period is the line item's, not invoice.period_* (Stripe's
  // invoice period is the usage window that preceded it).
  const period = invoice.lines?.data?.[0]?.period;
  const start = period?.start ?? invoice.period_start;
  const end = period?.end ?? invoice.period_end;

  try {
    await db.invoice.create({
      data: {
        subscriptionId: local.id,
        organizationId: local.organizationId,
        userId: local.userId,
        amountCents: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: "PAID",
        provider: "STRIPE",
        providerInvoiceId: invoice.id,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        periodStart: new Date(start * 1000),
        periodEnd: new Date(end * 1000),
        paidAt: new Date(paidAtUnix * 1000),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "duplicate";
    throw err;
  }
  return "recorded";
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

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const { billTo, organizationId, userId, productId, productPlanId, couponId } =
      checkoutSession.metadata ?? {};
    const stripeSubscriptionId = idOf(checkoutSession.subscription);

    const resolvedBillTo: BillTo | null =
      billTo === "organization" && organizationId
        ? { type: "organization", organizationId }
        : billTo === "individual" && userId
          ? { type: "individual", userId }
          : null;

    if (checkoutSession.mode !== "subscription" || !resolvedBillTo || !productId || !productPlanId || !stripeSubscriptionId) {
      logger.warn("billing.payment_unattributed", { provider: "stripe", session: checkoutSession.id });
      return NextResponse.json({ received: true });
    }

    // Plan ↔ product and payer must be real before any row is written.
    const plan = await db.productPlan.findUnique({ where: { id: productPlanId }, select: { productId: true } });
    const payer =
      resolvedBillTo.type === "organization"
        ? await db.organization.findUnique({ where: { id: resolvedBillTo.organizationId }, select: { id: true } })
        : await db.user.findUnique({ where: { id: resolvedBillTo.userId }, select: { id: true } });
    if (!plan || plan.productId !== productId || !payer) {
      logger.error("billing.payment_rejected", {
        provider: "stripe",
        session: checkoutSession.id,
        reason: !plan ? "plan_not_found" : plan.productId !== productId ? "plan_product_mismatch" : "attribution_not_found",
      });
      return NextResponse.json({ received: true });
    }

    await upsertSubscriptionFromCheckout({
      billTo: resolvedBillTo,
      productId,
      productPlanId,
      couponId,
      provider: "STRIPE",
      providerCustomerId: String(idOf(checkoutSession.customer as string | { id: string } | null) ?? ""),
      providerSubscriptionId: stripeSubscriptionId,
    });
    // Status and paid-through come from Stripe itself, never from the session.
    const sync = await syncStripeSubscription(stripeSubscriptionId);
    logger.info("billing.stripe_synced", { event: event.type, ...summarise(sync) });
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubscriptionId = subscriptionIdOfInvoice(invoice);
    if (!stripeSubscriptionId) return NextResponse.json({ received: true });
    const sync = await syncStripeSubscription(stripeSubscriptionId);
    const recorded = await recordStripeInvoice(invoice, stripeSubscriptionId);
    logger.info("billing.stripe_synced", { event: event.type, invoice: recorded, ...summarise(sync) });
    return NextResponse.json({ received: true });
  }

  if (SYNC_EVENTS.has(event.type)) {
    const object = event.data.object as Stripe.Subscription | Stripe.Invoice;
    const stripeSubscriptionId =
      object.object === "subscription" ? object.id : subscriptionIdOfInvoice(object as Stripe.Invoice);
    if (!stripeSubscriptionId) return NextResponse.json({ received: true });
    const sync = await syncStripeSubscription(stripeSubscriptionId);
    logger.info("billing.stripe_synced", { event: event.type, ...summarise(sync) });
    return NextResponse.json({ received: true });
  }

  // Refunds, disputes and everything else: acknowledged, no entitlement change
  // (see AS-P0-SECURITY-005 report — needs a schema change first).
  return NextResponse.json({ received: true });
}

function summarise(sync: Awaited<ReturnType<typeof syncStripeSubscription>>) {
  return sync.outcome === "synced"
    ? { outcome: sync.outcome, status: sync.status, extended: sync.extended, reason: sync.reason }
    : { outcome: sync.outcome };
}
