import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/billing/api-key-auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const usageSchema = z.object({
  productSlug: z.string(),
  metric: z.string().min(1).max(60),
  quantity: z.number().int().positive(),
});

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Invalid or missing API key." },
      { status: 401 }
    );
  }

  if (!auth.organizationId) {
    return NextResponse.json(
      { error: "This API key isn't associated with an organization." },
      { status: 400 }
    );
  }

  // Generous — this endpoint is meant for real telemetry (a satellite
  // product reporting usage per API call it handles), so the limit is sized
  // for legitimate high-frequency reporting, not a low anti-abuse ceiling.
  const { allowed } = await checkRateLimit(
    `usage-report:${auth.organizationId}`,
    300,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = usageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const product = await db.product.findUnique({
    where: { slug: parsed.data.productSlug },
  });
  if (!product) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  const record = await db.usageRecord.create({
    data: {
      organizationId: auth.organizationId,
      productId: product.id,
      metric: parsed.data.metric,
      quantity: parsed.data.quantity,
    },
  });

  return NextResponse.json({ usageRecord: { id: record.id } }, { status: 201 });
}
