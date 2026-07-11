import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/passwords";
import {
  generateOpaqueToken,
  hashToken,
  EMAIL_VERIFICATION_TTL_MS,
} from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/auth/email";
import { issueSession } from "@/lib/auth/issue-session";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import { trackEvent } from "@/lib/analytics/track";

const signupSchema = z.object({
  name: z.string().min(2, "Enter your full name").max(100),
  email: z.email("Enter a valid email address"),
  // bcrypt only uses the first 72 bytes of input — anything past that is
  // silently ignored, so an unbounded max would let two different long
  // passwords that share the same first 72 bytes both "work". Capping here
  // makes that limit explicit instead of surprising.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
});

export async function POST(request: Request) {
  const ip = requestIp(request);
  const { allowed } = await checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { name, email, passwordHash } });

  const rawToken = generateOpaqueToken();
  await db.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: "Verify your UAMSATech account",
    html: `<p>Welcome to UAMSATech. Verify your email to get started:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  await issueSession({ userId: user.id });
  await trackEvent("signup_completed", { userId: user.id });

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email } },
    { status: 201 }
  );
}
