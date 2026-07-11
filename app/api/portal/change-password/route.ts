import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { hashToken } from "@/lib/auth/tokens";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Bcrypt is intentionally slow (cost 12) — without a limit, this endpoint
  // is also a cheap way to force repeated expensive hashing on the server,
  // and repeated wrong-current-password guesses on your own account.
  const { allowed } = await checkRateLimit(
    `change-password:${session.sub}`,
    5,
    15 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const valid = await verifyPassword(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 401 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  // Keep the current session alive, revoke every other one — a password
  // change shouldn't log you out of the device you're using to change it.
  const store = await cookies();
  const currentRefreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const currentTokenHash = currentRefreshToken
    ? hashToken(currentRefreshToken)
    : null;

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logActivity(user.id, "user.password_changed");

  return NextResponse.json({ success: true });
}
