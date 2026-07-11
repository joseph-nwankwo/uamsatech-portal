import { NextResponse } from "next/server";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { hasPermission } from "@/lib/portal/permissions";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const updateOrgSchema = z.object({
  name: z.string().min(2, "Organization name is too short").max(100),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !session.orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!hasPermission(session.role as UserRole, "organization.manage")) {
    return NextResponse.json(
      { error: "Only owners and admins can update the organization." },
      { status: 403 }
    );
  }

  const { allowed } = await checkRateLimit(
    `org-update:${session.sub}`,
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
  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const organization = await db.organization.update({
    where: { id: session.orgId },
    data: { name: parsed.data.name },
  });

  await logActivity(
    session.sub,
    "organization.updated",
    { name: organization.name },
    organization.id
  );

  return NextResponse.json({ organization: { name: organization.name } });
}
