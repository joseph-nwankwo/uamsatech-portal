import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateApiKey } from "@/lib/billing/api-keys";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const createKeySchema = z.object({
  name: z.string().min(2, "Give the key a short name").max(60),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `api-key-create:${session.sub}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many API keys created. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { fullKey, keyPrefix, keyHash } = generateApiKey();

  const apiKey = await db.apiKey.create({
    data: {
      name: parsed.data.name,
      keyPrefix,
      keyHash,
      userId: session.sub,
      organizationId: session.orgId ?? null,
    },
  });

  await logActivity(session.sub, "api_key.created", {
    apiKeyId: apiKey.id,
    name: apiKey.name,
  });

  // fullKey is returned exactly once — the server never persists or
  // re-displays it after this response.
  return NextResponse.json({
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      createdAt: apiKey.createdAt,
    },
    fullKey,
  });
}
