import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { hasPermission } from "@/lib/portal/permissions";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !session.orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!hasPermission(session.role as UserRole, "members.invite")) {
    return NextResponse.json(
      { error: "You don't have permission to manage invitations." },
      { status: 403 }
    );
  }

  const { allowed } = await checkRateLimit(
    `invite-revoke:${session.sub}`,
    30,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const invitation = await db.invitation.findUnique({ where: { id } });
  if (!invitation || invitation.organizationId !== session.orgId) {
    return NextResponse.json(
      { error: "Invitation not found." },
      { status: 404 }
    );
  }

  await db.invitation.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await logActivity(
    session.sub,
    "member.invitation_revoked",
    { email: invitation.email },
    session.orgId
  );

  return NextResponse.json({ success: true });
}
