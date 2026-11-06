import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics/track";
import type { BillingProvider, Prisma, Subscription } from "@prisma/client";

/** The global client or an interactive-transaction client. */
export type DbClient = typeof db | Prisma.TransactionClient;

export type BillTo =
  | { type: "organization"; organizationId: string }
  | { type: "individual"; userId: string };

// Shared by all 3 providers' checkout-completion handlers. Upserts on the
// org+product or user+product unique key depending on who's paying — a
// webhook redelivery hits the `update` branch, never double-creating a row
// or double-counting a coupon redemption (see the `existing` check below).
export async function upsertSubscriptionFromCheckout(params: {
  billTo: BillTo;
  productId: string;
  productPlanId: string;
  couponId?: string;
  provider: BillingProvider;
  providerCustomerId: string;
  providerSubscriptionId: string;
}, client: DbClient = db, options: { emitEvent?: boolean } = {}): Promise<Subscription> {
  const { billTo, productId, productPlanId, couponId, provider } = params;

  const where =
    billTo.type === "organization"
      ? {
          organizationId_productId: {
            organizationId: billTo.organizationId,
            productId,
          },
        }
      : { userId_productId: { userId: billTo.userId, productId } };

  const existing = await client.subscription.findUnique({ where });

  const identity =
    billTo.type === "organization"
      ? { organizationId: billTo.organizationId }
      : { userId: billTo.userId };

  const subscription = await client.subscription.upsert({
    where,
    create: {
      ...identity,
      productId,
      productPlanId,
      couponId,
      status: "ACTIVE",
      provider,
      providerCustomerId: params.providerCustomerId,
      providerSubscriptionId: params.providerSubscriptionId,
    },
    update: {
      productPlanId,
      status: "ACTIVE",
      provider,
      providerCustomerId: params.providerCustomerId,
      providerSubscriptionId: params.providerSubscriptionId,
    },
  });

  if (!existing && couponId) {
    await client.coupon.update({
      where: { id: couponId },
      data: { timesRedeemed: { increment: 1 } },
    });
  }

  if (options.emitEvent !== false) await trackEvent("subscription_created", {
    organizationId:
      billTo.type === "organization" ? billTo.organizationId : undefined,
    metadata: { productId, provider, billTo: billTo.type },
  });

  return subscription;
}

// createInvoiceForSubscription was removed in AS-P0-SECURITY-004: it stamped
// every invoice with periodStart = paidAt = "now" and periodEnd = now + 1
// month regardless of the plan or the provider's payment time. Paystack and
// Flutterwave payments are now recorded by recordVerifiedOneTimePayment
// (lib/billing/one-time-payment.ts) from provider-confirmed data.
