import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/tokens";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `session-revoke-others:${session.sub}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const store = await cookies();
  const currentRefreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const currentTokenHash = currentRefreshToken
    ? hashToken(currentRefreshToken)
    : null;

  await db.refreshToken.updateMany({
    where: {
      userId: session.sub,
      revokedAt: null,
      ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
    },
    data: { revokedAt: new Date() },
  });

  await logActivity(session.sub, "session.revoked", { scope: "all_others" });

  return NextResponse.json({ success: true });
}
