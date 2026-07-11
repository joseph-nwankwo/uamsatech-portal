import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { issueSession } from "@/lib/auth/issue-session";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/tokens";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const acceptSchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `invite-accept:${session.sub}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { organization: true },
  });

  if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
    return NextResponse.json(
      { error: "This invitation is no longer valid." },
      { status: 400 }
    );
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This invitation has expired." },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: `This invitation was sent to ${invitation.email}. Sign in with that email to accept it.`,
      },
      { status: 403 }
    );
  }

  await db.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: invitation.organizationId,
      },
    },
    create: {
      userId: user.id,
      organizationId: invitation.organizationId,
      role: invitation.role,
    },
    update: {},
  });

  await db.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  await logActivity(
    user.id,
    "member.invitation_accepted",
    { role: invitation.role },
    invitation.organizationId
  );

  const store = await cookies();
  const currentRefreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (currentRefreshToken) {
    await db.refreshToken.updateMany({
      where: { tokenHash: hashToken(currentRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await issueSession({
    userId: user.id,
    organizationId: invitation.organizationId,
    role: invitation.role,
  });

  return NextResponse.json({
    success: true,
    organizationName: invitation.organization.name,
  });
}
