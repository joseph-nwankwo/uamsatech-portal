import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { signLaunchToken } from "@/lib/auth/launch-jwt";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { logActivity } from "@/lib/portal/audit";
import { resolveProductEntitlement } from "@/lib/portal/entitlement";

type LaunchTarget = { target: "lecturesuite" | "scholarsuite"; ssoUrl: string };

/**
 * Allowlist: portal product slug → canonical product identifier (the token's
 * `target`/`aud`) and that product's SSO endpoint. A Map (not a plain object)
 * so prototype keys such as "constructor" can never resolve to an entry.
 *
 * `lecturercraft` / `scholarcraft` are the portal catalog's existing slugs
 * (lib/site-config.ts, Product rows); the canonical identifiers are accepted
 * as aliases so the catalog can be renamed later without touching this route.
 */
const LECTURESUITE: LaunchTarget = {
  target: "lecturesuite",
  ssoUrl: env.LECTURESUITE_SSO_URL,
};
const SCHOLARSUITE: LaunchTarget = {
  target: "scholarsuite",
  ssoUrl: env.SCHOLARSUITE_SSO_URL,
};
const PRODUCT_MAP: ReadonlyMap<string, LaunchTarget> = new Map([
  ["lecturercraft", LECTURESUITE],
  ["lecturesuite", LECTURESUITE],
  ["scholarcraft", SCHOLARSUITE],
  ["scholarsuite", SCHOLARSUITE],
]);

/** Token-bearing redirects must never be cached or leak via Referer. */
function noStore<T extends NextResponse>(res: T): T {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ product: string }> }
) {
  const { product } = await params;

  const session = await getSession();
  if (!session) {
    const loginUrl = new URL("/login", env.NEXT_PUBLIC_APP_URL);
    return NextResponse.redirect(loginUrl);
  }

  const mapping = PRODUCT_MAP.get(product);
  if (!mapping) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  // The destination comes only from validated server config, never from the
  // request, so this route cannot be used as an open redirect.
  const destination = new URL(mapping.ssoUrl);
  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    return NextResponse.json({ error: "Product unavailable" }, { status: 500 });
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { email: true },
  });
  if (!user) {
    const loginUrl = new URL("/login", env.NEXT_PUBLIC_APP_URL);
    return NextResponse.redirect(loginUrl);
  }

  // Entitlement is enforced here, server-side, before any token exists. The
  // product SSO endpoints only accept tokens signed with CRAFT_LAUNCH_SECRET,
  // so no token means no product account is provisioned.
  const entitlement = await resolveProductEntitlement(session.sub, mapping.target);

  if (!entitlement.granted) {
    try {
      await logActivity(session.sub, "product.launch_denied", {
        product: mapping.target,
        slug: product,
        reason: entitlement.reason,
      });
    } catch (err) {
      logger.error("launch audit (denied) failed", { error: (err as Error).message });
    }
    return noStore(
      NextResponse.json(
        { error: "You do not have active access to this product." },
        { status: 403 }
      )
    );
  }

  // A grant must leave an audit record; if it cannot be written, refuse.
  try {
    await logActivity(
      session.sub,
      "product.launch_granted",
      {
        product: mapping.target,
        slug: product,
        source: entitlement.source,
        subscriptionId: entitlement.subscriptionId,
      },
      entitlement.organizationId ?? undefined
    );
  } catch (err) {
    logger.error("launch audit (granted) failed", { error: (err as Error).message });
    return noStore(
      NextResponse.json({ error: "Launch temporarily unavailable." }, { status: 503 })
    );
  }

  const token = await signLaunchToken(session.sub, user.email, mapping.target);
  destination.searchParams.set("token", token);

  return noStore(NextResponse.redirect(destination.toString()));
}
