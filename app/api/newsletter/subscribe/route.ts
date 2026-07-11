import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/auth/email";
import { trackEvent } from "@/lib/analytics/track";

const subscribeSchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const ip = requestIp(request);
  const { allowed } = await checkRateLimit(
    `newsletter:${ip}`,
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
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  const { email } = parsed.data;

  const existing = await db.newsletterSubscriber.findUnique({
    where: { email },
  });
  if (existing) {
    if (existing.unsubscribedAt) {
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { unsubscribedAt: null },
      });
      await trackEvent("newsletter_subscribed", {
        metadata: { reactivated: true },
      });
    }
    return NextResponse.json({ success: true });
  }

  const rawToken = generateOpaqueToken();
  await db.newsletterSubscriber.create({
    data: {
      email,
      unsubscribeTokenHash: hashToken(rawToken),
    },
  });

  const unsubscribeUrl = `${env.NEXT_PUBLIC_APP_URL}/newsletter/unsubscribe/${rawToken}`;
  await sendEmail({
    to: email,
    subject: "You're subscribed to the UAMSATech blog",
    html: `<p>Thanks for subscribing — you'll get an email when we publish something new.</p><p>Didn't mean to subscribe? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>`,
  });
  await trackEvent("newsletter_subscribed");

  return NextResponse.json({ success: true }, { status: 201 });
}
