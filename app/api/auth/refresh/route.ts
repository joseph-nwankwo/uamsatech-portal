import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/tokens";
import { issueSession } from "@/lib/auth/issue-session";

export async function POST() {
  const store = await cookies();
  const rawToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!rawToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const existing = await db.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      user: { include: { memberships: true } },
    },
  });

  if (
    !existing ||
    existing.revokedAt ||
    existing.expiresAt.getTime() < Date.now()
  ) {
    await clearAuthCookies();
    return NextResponse.json(
      { error: "Session expired. Please sign in again." },
      { status: 401 }
    );
  }

  // Rotate: revoke the presented refresh token and issue a new pair. This
  // limits the blast radius if a refresh token is ever stolen — reuse of a
  // revoked token is a strong signal of compromise.
  await db.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const membership = existing.organizationId
    ? existing.user.memberships.find(
        (m) => m.organizationId === existing.organizationId
      )
    : undefined;

  await issueSession({
    userId: existing.userId,
    organizationId: existing.organizationId ?? undefined,
    role: membership?.role,
  });

  return NextResponse.json({ success: true });
}
