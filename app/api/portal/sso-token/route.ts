import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { consumeLaunchToken } from "@/lib/portal/sso-token-store";

/**
 * GET /api/portal/sso-token?state=<state>
 *
 * Server-to-server endpoint: returns the launch JWT stored during the launch
 * step for the given state parameter, then removes it (single-use).
 *
 * Authentication: requires the X-Service-Secret header to equal PORTAL_SERVICE_SECRET.
 * This endpoint must NOT be accessible to browsers or end-users — it is
 * exclusively for the product backend (LectureSuite, ScholarSuite, etc.).
 */
export async function GET(req: Request): Promise<Response> {
  // This endpoint is only enabled when PORTAL_SERVICE_SECRET is configured.
  if (!env.PORTAL_SERVICE_SECRET) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Service authentication: the caller must present the shared secret.
  const presented = req.headers.get("x-service-secret");
  if (!presented || presented !== env.PORTAL_SERVICE_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  if (!state || typeof state !== "string" || state.length === 0) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  let token: string | null;
  try {
    token = await consumeLaunchToken(state);
  } catch {
    return NextResponse.json(
      { error: "Token store unavailable" },
      { status: 503 }
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "Token not found or expired" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { token },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    }
  );
}
