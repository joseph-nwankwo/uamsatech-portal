import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { logActivity } from "@/lib/portal/audit";

const featureRequestSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(3000),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to submit a request." },
      { status: 401 }
    );
  }

  const { allowed } = await checkRateLimit(
    `feature-request:${session.sub}`,
    5,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests submitted. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = featureRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const featureRequest = await db.featureRequest.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      userId: session.sub,
      votes: { create: { userId: session.sub } },
    },
    select: { id: true },
  });

  await logActivity(session.sub, "feature_request.created", {
    featureRequestId: featureRequest.id,
  });

  return NextResponse.json({ featureRequest }, { status: 201 });
}
