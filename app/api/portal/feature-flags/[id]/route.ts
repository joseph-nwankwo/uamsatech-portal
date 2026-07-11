import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const patchSchema = z.object({ isEnabled: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only owners can manage feature flags." },
      { status: 403 }
    );
  }

  const { allowed } = await checkRateLimit(
    `feature-flag-update:${session.sub}`,
    30,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id } = await params;
  const flag = await db.featureFlag.update({
    where: { id },
    data: { isEnabled: parsed.data.isEnabled },
  });

  await logActivity(session.sub, "feature_flag.updated", {
    key: flag.key,
    isEnabled: flag.isEnabled,
  });

  return NextResponse.json({
    flag: { id: flag.id, isEnabled: flag.isEnabled },
  });
}
