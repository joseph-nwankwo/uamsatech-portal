import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Enter your full name").max(100),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `profile-update:${session.sub}`,
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
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const user = await db.user.update({
    where: { id: session.sub },
    data: { name: parsed.data.name },
  });

  await logActivity(session.sub, "user.profile_updated", { name: user.name });

  return NextResponse.json({ user: { name: user.name } });
}
