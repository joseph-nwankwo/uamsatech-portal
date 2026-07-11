import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  generateOpaqueToken,
  hashToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/auth/email";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const GENERIC_MESSAGE =
  "If an account exists for that email, we've sent a password reset link.";

export async function POST(request: Request) {
  const ip = requestIp(request);
  const { allowed } = await checkRateLimit(
    `forgot-password:${ip}`,
    5,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Always return the same generic response whether or not the account
  // exists, so this endpoint can't be used to enumerate registered emails.
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user) {
    const rawToken = generateOpaqueToken();
    await db.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your UAMSATech password",
      html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    });
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
