import { NextResponse } from "next/server";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { hasPermission } from "@/lib/portal/permissions";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const roleSchema = z.object({ role: z.enum(["MEMBER", "ADMIN", "OWNER"]) });

async function loadTargetMembership(
  membershipId: string,
  organizationId: string
) {
  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: true },
  });
  if (!membership || membership.organizationId !== organizationId) {
    return null;
  }
  return membership;
}

async function countOwners(organizationId: string) {
  return db.membership.count({
    where: { organizationId, role: "OWNER" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const session = await getSession();
  if (!session || !session.orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!hasPermission(session.role as UserRole, "members.changeRole")) {
    return NextResponse.json(
      { error: "Only owners can change member roles." },
      { status: 403 }
    );
  }

  const { allowed } = await checkRateLimit(
    `member-role-change:${session.sub}`,
    30,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { membershipId } = await params;
  const target = await loadTargetMembership(membershipId, session.orgId);
  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.role === "OWNER" && parsed.data.role !== "OWNER") {
    const owners = await countOwners(session.orgId);
    if (owners <= 1) {
      return NextResponse.json(
        {
          error: "This is the only owner. Promote someone else to owner first.",
        },
        { status: 400 }
      );
    }
  }

  const updated = await db.membership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
  });

  await logActivity(
    session.sub,
    "member.role_changed",
    { targetUserEmail: target.user.email, newRole: updated.role },
    session.orgId
  );

  return NextResponse.json({
    membership: { id: updated.id, role: updated.role },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const session = await getSession();
  if (!session || !session.orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!hasPermission(session.role as UserRole, "members.remove")) {
    return NextResponse.json(
      { error: "You don't have permission to remove members." },
      { status: 403 }
    );
  }

  const { allowed } = await checkRateLimit(
    `member-remove:${session.sub}`,
    30,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const { membershipId } = await params;
  const target = await loadTargetMembership(membershipId, session.orgId);
  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.userId === session.sub) {
    return NextResponse.json(
      { error: 'Use "Leave organization" to remove yourself.' },
      { status: 400 }
    );
  }

  // Admins can only remove members, not other admins or the owner.
  if (session.role === "ADMIN" && target.role !== "MEMBER") {
    return NextResponse.json(
      { error: "Admins can only remove members, not admins or owners." },
      { status: 403 }
    );
  }

  if (target.role === "OWNER") {
    const owners = await countOwners(session.orgId);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "You can't remove the only owner." },
        { status: 400 }
      );
    }
  }

  await db.membership.delete({ where: { id: membershipId } });

  await logActivity(
    session.sub,
    "member.removed",
    { targetUserEmail: target.user.email, role: target.role },
    session.orgId
  );

  return NextResponse.json({ success: true });
}
