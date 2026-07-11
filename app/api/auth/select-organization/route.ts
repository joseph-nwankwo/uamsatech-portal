import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { issueSession } from "@/lib/auth/issue-session";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/tokens";

const selectOrgSchema = z.object({
  organizationId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = selectOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.sub,
        organizationId: parsed.data.organizationId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You don't have access to that organization." },
      { status: 403 }
    );
  }

  const store = await cookies();
  const currentRefreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (currentRefreshToken) {
    await db.refreshToken.updateMany({
      where: { tokenHash: hashToken(currentRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await issueSession({
    userId: session.sub,
    organizationId: membership.organizationId,
    role: membership.role,
  });

  return NextResponse.json({ success: true });
}
