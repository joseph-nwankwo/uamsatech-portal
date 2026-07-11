import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function getPortalContext() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) redirect("/login");

  const activeMembership = session.orgId
    ? user.memberships.find((m) => m.organizationId === session.orgId)
    : undefined;

  return { session, user, activeMembership };
}
