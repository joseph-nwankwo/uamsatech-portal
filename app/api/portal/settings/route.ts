import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const updateSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `settings-update:${session.sub}`,
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
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.sub },
    data: { emailNotificationsEnabled: parsed.data.emailNotificationsEnabled },
  });

  await logActivity(session.sub, "user.settings_updated", {
    emailNotificationsEnabled: user.emailNotificationsEnabled,
  });

  return NextResponse.json({
    emailNotificationsEnabled: user.emailNotificationsEnabled,
  });
}
