import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/billing/stripe";

/**
 * Stripe paid-through persistence (AS-P0-SECURITY-005).
 *
 * Stripe subscriptions are recurring and Stripe owns the billing period, so
 * nothing here adds months or years. On API 2026-06-24.dahlia (stripe@22) the
 * period lives on the subscription ITEM (`items.data[].current_period_end`),
 * not on the Subscription object.
 *
 * Every subscription-related webhook triggers a sync that RE-FETCHES the
 * subscription from the Stripe API, so the event payload's own fields are
 * never trusted and out-of-order events converge on Stripe's current state.
 * The fetch happens while the local row is locked, so concurrent syncs are
 * serialised and the freshest state is written last.
 *
 * A paid-through date is accepted only when ALL hold:
 * - status is `active` (trialing / past_due / unpaid / incomplete / paused /
 *   canceled never extend);
 * - the latest invoice is `paid` (Stripe advances the item period at renewal
 *   BEFORE the renewal invoice is paid; an unpaid renewal must not extend);
 * - exactly one item, whose price is the plan's stripePriceId, in the plan's
 *   currency;
 * then paid-through = item.current_period_end, capped by `cancel_at` if set.
 * It only ever moves forward.
 */

export function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    default:
      return "CANCELED"; // canceled, incomplete, incomplete_expired, paused
  }
}

export type StripePaidThrough =
  | { paidThrough: Date }
  | {
      paidThrough: null;
      reason:
        | "not_active"
        | "latest_invoice_unpaid"
        | "latest_invoice_unknown"
        | "unexpected_items"
        | "price_mismatch"
        | "currency_mismatch"
        | "no_period";
    };

export function deriveStripePaidThrough(
  sub: Stripe.Subscription,
  plan: { stripePriceId: string | null; currency: string } | null
): StripePaidThrough {
  if (sub.status !== "active") return { paidThrough: null, reason: "not_active" };

  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return { paidThrough: null, reason: "latest_invoice_unknown" };
  if (invoice.status !== "paid") return { paidThrough: null, reason: "latest_invoice_unpaid" };

  const items = sub.items?.data ?? [];
  if (items.length !== 1) return { paidThrough: null, reason: "unexpected_items" };
  const item = items[0];
  if (!plan?.stripePriceId || item.price?.id !== plan.stripePriceId) {
    return { paidThrough: null, reason: "price_mismatch" };
  }
  if ((item.price.currency ?? "").toUpperCase() !== plan.currency.toUpperCase()) {
    return { paidThrough: null, reason: "currency_mismatch" };
  }

  let end = item.current_period_end;
  if (!Number.isSafeInteger(end) || end <= 0) return { paidThrough: null, reason: "no_period" };
  if (typeof sub.cancel_at === "number" && sub.cancel_at > 0 && sub.cancel_at < end) end = sub.cancel_at;
  return { paidThrough: new Date(end * 1000) };
}

export type StripeSyncResult =
  | { outcome: "unknown_subscription" }
  | {
      outcome: "synced";
      subscriptionId: string;
      status: SubscriptionStatus;
      currentPeriodEnd: Date | null;
      extended: boolean;
      reason: string | null;
    };

/** Throws on Stripe/API or database failure, so the webhook returns 500 and Stripe retries. */
export async function syncStripeSubscription(stripeSubscriptionId: string): Promise<StripeSyncResult> {
  const local = await db.subscription.findFirst({
    where: { provider: "STRIPE", providerSubscriptionId: stripeSubscriptionId },
    select: { id: true },
  });
  if (!local) return { outcome: "unknown_subscription" };

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM subscriptions WHERE id = ${local.id} FOR UPDATE`;
      const before = await tx.subscription.findUnique({
        where: { id: local.id },
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
          userId: true,
          organizationId: true,
          productPlan: { select: { stripePriceId: true, currency: true } },
        },
      });
      if (!before) return { outcome: "unknown_subscription" } as const;

      const remote = await getStripeClient().subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["latest_invoice"],
      });
      if (remote.id !== stripeSubscriptionId) throw new Error("Stripe returned a different subscription");

      const status = mapStripeStatus(remote.status);
      const decision = deriveStripePaidThrough(remote, before.productPlan);

      await tx.subscription.update({
        where: { id: before.id },
        data: { status, cancelAtPeriodEnd: remote.cancel_at_period_end },
      });

      let extended = false;
      if (decision.paidThrough) {
        const { count } = await tx.subscription.updateMany({
          where: {
            id: before.id,
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { lt: decision.paidThrough } }],
          },
          data: { currentPeriodEnd: decision.paidThrough },
        });
        extended = count === 1;
      }

      const after = await tx.subscription.findUnique({
        where: { id: before.id },
        select: { currentPeriodEnd: true },
      });
      const currentPeriodEnd = after?.currentPeriodEnd ?? null;
      const reason = decision.paidThrough ? null : decision.reason;

      if (extended || status !== before.status || (reason && reason !== "not_active")) {
        await tx.auditLog.create({
          data: {
            userId: before.userId,
            organizationId: before.organizationId,
            action:
              reason && ["unexpected_items", "price_mismatch", "currency_mismatch", "no_period"].includes(reason)
                ? "billing.renewal_needs_review"
                : extended
                  ? "billing.entitlement_extended"
                  : "billing.subscription_status_changed",
            metadata: {
              provider: "STRIPE",
              subscriptionId: before.id,
              stripeStatus: remote.status,
              previousStatus: before.status,
              status,
              previousCurrentPeriodEnd: before.currentPeriodEnd?.toISOString() ?? null,
              currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
              cancelAtPeriodEnd: remote.cancel_at_period_end,
              reason,
            },
          },
        });
      }

      return { outcome: "synced", subscriptionId: before.id, status, currentPeriodEnd, extended, reason } as const;
    },
    { timeout: 20_000 }
  );
}
