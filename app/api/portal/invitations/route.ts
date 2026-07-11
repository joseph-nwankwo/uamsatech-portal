import { NextResponse } from "next/server";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/auth/email";
import {
  generateOpaqueToken,
  hashToken,
  INVITATION_TTL_MS,
} from "@/lib/auth/tokens";
import { logActivity } from "@/lib/portal/audit";
import { hasPermission } from "@/lib/portal/permissions";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const inviteSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: z.enum(["MEMBER", "ADMIN", "OWNER"]).default("MEMBER"),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const role = session.role as UserRole;
  if (!hasPermission(role, "members.invite")) {
    return NextResponse.json(
      { error: "You don't have permission to invite members." },
      { status: 403 }
    );
  }

  // Each invite sends a real email — without a limit here, an authenticated
  // member could use this endpoint to email-bomb arbitrary addresses.
  const { allowed } = await checkRateLimit(
    `invite:${session.sub}`,
    20,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many invitations sent. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, role: invitedRole } = parsed.data;

  if (invitedRole === "OWNER" && role !== "OWNER") {
    return NextResponse.json(
      { error: "Only owners can invite someone as an owner." },
      { status: 403 }
    );
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: session.orgId,
        },
      },
    });
    if (existingMembership) {
      return NextResponse.json(
        { error: "This person is already a member of your organization." },
        { status: 409 }
      );
    }
  }

  const pending = await db.invitation.findUnique({
    where: { email_organizationId: { email, organizationId: session.orgId } },
  });
  if (
    pending &&
    !pending.acceptedAt &&
    !pending.revokedAt &&
    pending.expiresAt > new Date()
  ) {
    return NextResponse.json(
      { error: "There's already a pending invitation for this email." },
      { status: 409 }
    );
  }

  const rawToken = generateOpaqueToken();
  const invitation = await db.invitation.upsert({
    where: { email_organizationId: { email, organizationId: session.orgId } },
    create: {
      email,
      organizationId: session.orgId,
      role: invitedRole,
      tokenHash: hashToken(rawToken),
      invitedByUserId: session.sub,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
    update: {
      role: invitedRole,
      tokenHash: hashToken(rawToken),
      invitedByUserId: session.sub,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      acceptedAt: null,
      revokedAt: null,
    },
  });

  const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${rawToken}`;
  const organization = await db.organization.findUnique({
    where: { id: session.orgId },
  });
  await sendEmail({
    to: email,
    subject: `You've been invited to join ${organization?.name ?? "an organization"} on UAMSATech`,
    html: `<p>You've been invited to join <strong>${organization?.name ?? "an organization"}</strong> on UAMSATech as ${invitedRole.toLowerCase()}.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>This invitation expires in 7 days.</p>`,
  });

  await logActivity(
    session.sub,
    "member.invited",
    { email, role: invitedRole },
    session.orgId
  );

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    },
    { status: 201 }
  );
}
