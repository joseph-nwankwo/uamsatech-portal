import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/passwords";
import { hashToken } from "@/lib/auth/tokens";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { logActivity } from "@/lib/portal/audit";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const verification = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });

  if (
    !verification ||
    verification.type !== "PASSWORD_RESET" ||
    verification.consumedAt ||
    verification.expiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.$transaction([
    db.user.update({
      where: { id: verification.userId },
      data: { passwordHash },
    }),
    db.verificationToken.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    }),
    // Resetting a password revokes every existing session — standard
    // practice so a compromised session can't outlive a password change.
    db.refreshToken.updateMany({
      where: { userId: verification.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await clearAuthCookies();
  await logActivity(verification.userId, "user.password_reset");

  return NextResponse.json({ success: true });
}
