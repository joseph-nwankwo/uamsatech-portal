import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin/auth";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

// Feature flags are global, platform-wide rows (they include the switches for
// which payment providers every customer sees), so only platform admins may
// change them (S2). Non-admins get the same 404 as every other admin surface.

const patchSchema = z.object({ isEnabled: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const actorId = admin.user.id;

  const { allowed } = await checkRateLimit(
    `admin-feature-flag-update:${actorId}`,
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
  const newValue = parsed.data.isEnabled;
  const { id } = await params;

  // Read, update and audit in one transaction so a flag never changes
  // without a matching audit row, and oldValue is the value actually replaced.
  const flag = await db.$transaction(async (tx) => {
    const current = await tx.featureFlag.findUnique({ where: { id } });
    if (!current) return null;
    if (current.isEnabled === newValue) return current;

    const updated = await tx.featureFlag.update({
      where: { id },
      data: { isEnabled: newValue },
    });
    await logActivity(
      actorId,
      "feature_flag.updated",
      { key: updated.key, oldValue: current.isEnabled, newValue },
      undefined,
      tx
    );
    return updated;
  });

  if (!flag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    flag: { id: flag.id, isEnabled: flag.isEnabled },
  });
}
