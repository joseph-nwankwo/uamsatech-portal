import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

function adminEmails(): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}

// Deliberately 404s rather than showing a "not authorized" page — a
// non-admin (i.e. any ordinary customer) shouldn't be able to tell /admin
// exists at all, the same way a cross-user resource lookup 404s elsewhere
// in the portal rather than 403ing.
export async function getAdminContext() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user || !isAdminEmail(user.email)) {
    logger.warn("admin.access_denied", { userId: session.sub });
    notFound();
  }

  return { user };
}
