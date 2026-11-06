import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import {
  authenticateProductService,
  decideEntitlementForEmail,
} from "@/lib/portal/entitlement-service";

/**
 * POST /api/internal/entitlements/verify — server-to-server only
 * (AS-P0-SECURITY-006A).
 *
 * Request:  Authorization: Bearer <that product's entitlement service secret>
 *           { "product": "lecturesuite" | "scholarsuite", "subject": { "email": "…" } }
 * Response: 200 CentralEntitlementDecision (lib/portal/entitlement-service.ts)
 *           400 malformed / unknown product · 401 bad credential ·
 *           429 rate limited · 503 not configured or decision unavailable.
 *
 * Every non-200 means "no decision": products must deny (fail closed).
 * The credential travels only in the Authorization header, never the URL.
 * Logs carry product, decision and reason only — never the credential or email.
 */

const bodySchema = z.object({
  product: z.string().max(40),
  subject: z.object({ email: z.string().email().max(320) }),
});

const noStore = { "Cache-Control": "no-store" };

function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  // Throttle by caller IP before the credential is examined, so guessing
  // credentials is rate-limited too.
  const ipLimit = await checkRateLimit(`entitlement-verify-ip:${requestIp(request)}`, 600, 60 * 1000);
  if (!ipLimit.allowed) return reply({ error: "rate_limited" }, 429);

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "malformed_request" }, 400);

  const auth = authenticateProductService(request.headers.get("authorization"), parsed.data.product);
  if (!auth.ok) {
    logger.warn("entitlement.verify_refused", { product: parsed.data.product.slice(0, 40), error: auth.error });
    return reply({ error: auth.error }, auth.status);
  }

  const { allowed } = await checkRateLimit(`entitlement-verify:${auth.product}`, 1200, 60 * 1000);
  if (!allowed) return reply({ error: "rate_limited" }, 429);

  try {
    const decision = await decideEntitlementForEmail(parsed.data.subject.email, auth.product);
    logger.info("entitlement.verified", { product: auth.product, decision: decision.decision, reason: decision.reason });
    return reply(decision, 200);
  } catch (err) {
    logger.error("entitlement.verify_failed", { product: auth.product, error: (err as Error).message });
    return reply({ error: "unavailable" }, 503);
  }
}
