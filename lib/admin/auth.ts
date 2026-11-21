import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { logger } from "@/lib/logger";

/**
 * ADMIN_EMAILS, normalized. Missing or empty means nobody is an admin
 * (fail closed).
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map(normalizeEmail).filter(Boolean));
}

type AdminCandidate = { email: string; emailVerified: Date | null } | null;

/**
 * The whole admin decision, from a DB user row — never from JWT claims.
 * The account must have proven it owns the address (emailVerified) and that
 * address must be allowlisted. Without the verification check, anyone could
 * register an allowlisted address that the real admin hasn't claimed yet.
 */
export function isAdminUser(
  user: AdminCandidate,
  adminEmails: Set<string> = parseAdminEmails(env.ADMIN_EMAILS)
): boolean {
  if (!user || !user.emailVerified) return false;
  return adminEmails.has(normalizeEmail(user.email));
}

/**
 * Loads the session's user from the DB and applies isAdminUser. Cached per
 * request so the admin layout and page share one lookup.
 */
const loadAdmin = cache(async () => {
  const session = await getSession();
  if (!session) return { session: null, user: null } as const;

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user || !isAdminUser(user)) {
    logger.warn("admin.access_denied", { userId: session.sub });
    return { session, user: null } as const;
  }
  return { session, user } as const;
});

// Deliberately 404s rather than showing a "not authorized" page — a
// non-admin (i.e. any ordinary customer) shouldn't be able to tell /admin
// exists at all, the same way a cross-user resource lookup 404s elsewhere
// in the portal rather than 403ing.
//
// Call this in every /admin page as well as the layout: a layout and its
// page render in parallel and layouts aren't re-run on client navigation,
// so a layout-only check does not stop a page's own queries.
export async function getAdminContext() {
  const { session, user } = await loadAdmin();
  if (!session) redirect("/login");
  if (!user) notFound();
  return { user };
}

/**
 * For admin API route handlers: returns the admin user, or a 404 response
 * (same not-found answer as the pages) to return as-is.
 */
export async function requireAdminApi(): Promise<
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof loadAdmin>>["user"]>;
    }
  | { ok: false; response: NextResponse }
> {
  const { user } = await loadAdmin();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, user };
}
