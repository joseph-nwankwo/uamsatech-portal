import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics/track";
import type { BillingProvider, Subscription } from "@prisma/client";

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
}): Promise<Subscription> {
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

  const existing = await db.subscription.findUnique({ where });

  const identity =
    billTo.type === "organization"
      ? { organizationId: billTo.organizationId }
      : { userId: billTo.userId };

  const subscription = await db.subscription.upsert({
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
    await db.coupon.update({
      where: { id: couponId },
      data: { timesRedeemed: { increment: 1 } },
    });
  }

  await trackEvent("subscription_created", {
    organizationId:
      billTo.type === "organization" ? billTo.organizationId : undefined,
    metadata: { productId, provider, billTo: billTo.type },
  });

  return subscription;
}

export async function createInvoiceForSubscription(
  subscription: Subscription,
  params: {
    amountCents: number;
    currency: string;
    provider: BillingProvider;
    providerInvoiceId: string;
    hostedInvoiceUrl?: string;
  }
) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return db.invoice.create({
    data: {
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      userId: subscription.userId,
      amountCents: params.amountCents,
      currency: params.currency,
      status: "PAID",
      provider: params.provider,
      providerInvoiceId: params.providerInvoiceId,
      hostedInvoiceUrl: params.hostedInvoiceUrl ?? null,
      periodStart: now,
      periodEnd,
      paidAt: now,
    },
  });
}
