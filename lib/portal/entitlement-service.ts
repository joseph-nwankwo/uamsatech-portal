import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { resolveProductEntitlement, type DenialReason } from "@/lib/portal/entitlement";
import type { LaunchTargetProduct } from "@/lib/auth/launch-jwt";

/**
 * Central entitlement verification for product backends (AS-P0-SECURITY-006A).
 *
 * Products call POST /api/internal/entitlements/verify on login, registration
 * and every refresh-token rotation. The decision is exactly the one the SSO
 * launch route uses (resolveProductEntitlement) — there is no second policy.
 */

export const SERVICE_PRODUCTS = ["lecturesuite", "scholarsuite"] as const satisfies readonly LaunchTargetProduct[];

/** ACTIVE = entitled now. SUSPENDED / REVOKED are reserved for the dispute and
 *  refund lifecycle (AS-P0-SECURITY-008); products must already treat them as deny. */
export type EntitlementStatus = "ACTIVE" | "NONE" | "EXPIRED" | "DENIED" | "SUSPENDED" | "REVOKED";

export type CentralEntitlementDecision = {
  v: 1;
  product: LaunchTargetProduct;
  decision: "GRANTED" | "DENIED";
  status: EntitlementStatus;
  /** Machine-readable reason for a denial; null when granted. Never includes billing details. */
  reason: string | null;
  /** Paid-through instant (ISO-8601 UTC) when granted, else null. */
  paidThrough: string | null;
  decidedAt: string;
};

export type ServiceAuthResult =
  | { ok: true; product: LaunchTargetProduct }
  | { ok: false; status: 400 | 401 | 503; error: "unknown_product" | "unauthorized" | "not_configured" };

function isServiceProduct(value: unknown): value is LaunchTargetProduct {
  return typeof value === "string" && (SERVICE_PRODUCTS as readonly string[]).includes(value);
}

function credentialFor(product: LaunchTargetProduct): string | undefined {
  return product === "lecturesuite"
    ? env.LECTURESUITE_ENTITLEMENT_SERVICE_SECRET
    : env.SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET;
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * The credential is bound to ONE product: LectureSuite's credential cannot
 * obtain decisions for ScholarSuite. Comparison is over fixed-length digests,
 * so it is timing-safe whatever the presented length.
 */
export function authenticateProductService(
  authorization: string | null,
  product: unknown
): ServiceAuthResult {
  if (!isServiceProduct(product)) return { ok: false, status: 400, error: "unknown_product" };
  const expected = credentialFor(product);
  if (!expected) return { ok: false, status: 503, error: "not_configured" };

  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? "");
  if (!match) return { ok: false, status: 401, error: "unauthorized" };
  if (!timingSafeEqual(digest(match[1]), digest(expected))) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true, product };
}

const STATUS_FOR_DENIAL: Record<DenialReason, EntitlementStatus> = {
  no_subscription: "NONE",
  expired: "EXPIRED",
  period_end_unknown: "DENIED",
  trial_not_authorized: "DENIED",
  past_due: "DENIED",
  canceled: "DENIED",
  status_not_entitled: "DENIED",
};

/**
 * Decides entitlement for the portal account with this email. The product
 * identifies users by email (its users are provisioned from the launch token's
 * email claim). An email that matches no portal account — or, case-insensitively,
 * more than one — is denied rather than guessed.
 */
export async function decideEntitlementForEmail(
  email: string,
  product: LaunchTargetProduct,
  now: Date = new Date()
): Promise<CentralEntitlementDecision> {
  const base = { v: 1 as const, product, decidedAt: now.toISOString() };

  const users = await db.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
    take: 2,
  });
  if (users.length !== 1) {
    return { ...base, decision: "DENIED", status: "NONE", reason: users.length ? "ambiguous_account" : "no_account", paidThrough: null };
  }

  const decision = await resolveProductEntitlement(users[0].id, product, now);
  if (!decision.granted) {
    return { ...base, decision: "DENIED", status: STATUS_FOR_DENIAL[decision.reason], reason: decision.reason, paidThrough: null };
  }

  const sub = await db.subscription.findUnique({
    where: { id: decision.subscriptionId },
    select: { currentPeriodEnd: true },
  });
  const paidThrough = sub?.currentPeriodEnd ?? null;
  // resolveProductEntitlement only grants with a future paid-through date; if
  // it has moved since, deny rather than report a grant without an expiry.
  if (!paidThrough || paidThrough.getTime() <= now.getTime()) {
    return { ...base, decision: "DENIED", status: "EXPIRED", reason: "expired", paidThrough: null };
  }
  return { ...base, decision: "GRANTED", status: "ACTIVE", reason: null, paidThrough: paidThrough.toISOString() };
}
