import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/passwords";
import { issueSession } from "@/lib/auth/issue-session";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import { logActivity } from "@/lib/portal/audit";
import { trackEvent } from "@/lib/analytics/track";
import { logger } from "@/lib/logger";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});

// Precomputed once so a login attempt for a non-existent email still runs a
// bcrypt compare of similar cost — avoids timing-based user enumeration.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 12);

export async function POST(request: Request) {
  const ip = requestIp(request);

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const { allowed } = await checkRateLimit(
    `login:${ip}:${email}`,
    10,
    15 * 60 * 1000
  );
  if (!allowed) {
    logger.warn("auth.login_rate_limited", { ip });
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true } } },
  });

  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH
  );

  if (!user || !user.passwordHash || !valid) {
    logger.warn("auth.login_failed", { ip });
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const memberships = user.memberships;
  const singleMembership = memberships.length === 1 ? memberships[0] : null;

  await issueSession({
    userId: user.id,
    organizationId: singleMembership?.organizationId,
    role: singleMembership?.role,
  });

  await logActivity(user.id, "user.login");
  await trackEvent("login", { userId: user.id });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: !!user.emailVerified,
    },
    memberships: memberships.map((m) => ({
      organizationId: m.organizationId,
      name: m.organization.name,
      role: m.role,
    })),
    requiresOrgSelection: memberships.length > 1,
  });
}
