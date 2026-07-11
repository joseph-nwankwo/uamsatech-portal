import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/tokens";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";

export async function POST() {
  const session = await getSession();
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await db.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await clearAuthCookies();

  if (session) {
    await logActivity(session.sub, "user.logout");
  }

  return NextResponse.json({ success: true });
}
