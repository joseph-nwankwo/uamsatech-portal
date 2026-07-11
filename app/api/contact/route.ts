import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import { trackEvent } from "@/lib/analytics/track";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  institution: z.string().max(200).optional(),
  message: z.string().min(10).max(5000),
});

export async function POST(request: Request) {
  const ip = requestIp(request);
  const { allowed } = await checkRateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages sent. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await db.contactMessage.create({ data: parsed.data });
  await trackEvent("contact_submitted");

  return NextResponse.json({ success: true }, { status: 201 });
}
