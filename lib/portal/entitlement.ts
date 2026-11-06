import type { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { LaunchTargetProduct } from "@/lib/auth/launch-jwt";

/**
 * Product entitlement for SSO launch (AS-P0-SECURITY-002).
 *
 * Kept separate from authentication (lib/auth/session) and from product-role
 * assignment (done by each product backend after launch). Fails closed: any
 * state this schema cannot positively establish as entitled is denied.
 *
 * What the current schema can and cannot express (see the P0 report):
 * - SubscriptionStatus is ACTIVE | TRIALING | PAST_DUE | CANCELED only. Stripe's
 *   unpaid → PAST_DUE and incomplete / incomplete_expired / paused → CANCELED
 *   (app/api/billing/stripe/webhook/route.ts), so all of those are denied.
 * - currentPeriodEnd is the only expiry field. It is required: an ACTIVE row
 *   with no paid-through date cannot be shown to be unexpired.
 * - There is no record of an explicitly authorised trial, so TRIALING is denied.
 * - There is no institutional-licence or seat model. The institutional source
 *   is an Organization subscription for the product, and the authorisation is
 *   the user's Membership in that organization.
 */

/**
 * Portal catalog slugs (Product.slug) that represent each canonical product.
 * Product-specific: one product's entitlement never satisfies another's.
 */
const CATALOG_SLUGS: Record<LaunchTargetProduct, readonly string[]> = {
  lecturesuite: ["lecturercraft", "lecturesuite"],
  scholarsuite: ["scholarcraft", "scholarsuite"],
};

export type DenialReason =
  | "no_subscription"
  | "period_end_unknown"
  | "expired"
  | "trial_not_authorized"
  | "past_due"
  | "canceled"
  | "status_not_entitled";

export type EntitlementSource = "individual" | "institution";

export type EntitlementDecision =
  | {
      granted: true;
      source: EntitlementSource;
      subscriptionId: string;
      organizationId: string | null;
    }
  | { granted: false; reason: DenialReason };

export type SubscriptionFacts = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Pure policy: does this single subscription row entitle access right now? */
export function evaluateSubscription(
  sub: SubscriptionFacts,
  now: Date
): { ok: true } | { ok: false; reason: DenialReason } {
  switch (sub.status) {
    case "ACTIVE":
      // Covers scheduled cancellation too (cancelAtPeriodEnd): access lasts
      // exactly until the paid-through date, never beyond it.
      if (!sub.currentPeriodEnd) return { ok: false, reason: "period_end_unknown" };
      if (sub.currentPeriodEnd.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
      return { ok: true };
    case "TRIALING":
      return { ok: false, reason: "trial_not_authorized" };
    case "PAST_DUE":
      return { ok: false, reason: "past_due" }; // no approved grace-period policy
    case "CANCELED":
      return { ok: false, reason: "canceled" };
    default:
      return { ok: false, reason: "status_not_entitled" };
  }
}

/**
 * Resolves whether `userId` may launch `target`, from an individual
 * subscription or an institutional (organization) subscription the user is a
 * member of. Individual entitlement is checked first.
 */
export async function resolveProductEntitlement(
  userId: string,
  target: LaunchTargetProduct,
  now: Date = new Date()
): Promise<EntitlementDecision> {
  const rows = await db.subscription.findMany({
    where: {
      product: { slug: { in: [...CATALOG_SLUGS[target]] } },
      OR: [
        { userId },
        { organization: { memberships: { some: { userId } } } },
      ],
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (rows.length === 0) return { granted: false, reason: "no_subscription" };

  const individual = rows.filter((r) => r.userId === userId);
  const institutional = rows.filter((r) => r.userId !== userId && r.organizationId);

  let firstDenial: DenialReason | null = null;
  for (const [source, list] of [
    ["individual", individual],
    ["institution", institutional],
  ] as const) {
    for (const row of list) {
      const verdict = evaluateSubscription(row, now);
      if (verdict.ok) {
        return {
          granted: true,
          source,
          subscriptionId: row.id,
          organizationId: row.organizationId,
        };
      }
      firstDenial ??= verdict.reason;
    }
  }
  return { granted: false, reason: firstDenial ?? "no_subscription" };
}
