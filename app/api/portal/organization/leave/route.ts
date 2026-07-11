import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { issueSession } from "@/lib/auth/issue-session";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST() {
  const session = await getSession();
  if (!session || !session.orgId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `org-leave:${session.sub}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.sub,
        organizationId: session.orgId,
      },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Membership not found." },
      { status: 404 }
    );
  }

  if (membership.role === "OWNER") {
    const owners = await db.membership.count({
      where: { organizationId: session.orgId, role: "OWNER" },
    });
    if (owners <= 1) {
      return NextResponse.json(
        {
          error:
            "You're the only owner. Promote someone else to owner before leaving.",
        },
        { status: 400 }
      );
    }
  }

  await logActivity(
    session.sub,
    "organization.left",
    { role: membership.role },
    session.orgId
  );

  await db.membership.delete({ where: { id: membership.id } });

  await issueSession({ userId: session.sub });

  return NextResponse.json({ success: true });
}
