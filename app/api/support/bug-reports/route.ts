import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, requestIp } from "@/lib/auth/rate-limit";
import { logActivity } from "@/lib/portal/audit";

const bugReportSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  stepsToReproduce: z.string().max(5000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  productSlug: z.string().optional(),
  email: z.email().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  const ip = requestIp(request);
  const { allowed } = await checkRateLimit(
    `bug-report:${session?.sub ?? ip}`,
    5,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many reports submitted. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bugReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  if (!session && !parsed.data.email) {
    return NextResponse.json(
      { error: "Enter an email so we can follow up." },
      { status: 400 }
    );
  }

  const report = await db.bugReport.create({
    data: {
      ...parsed.data,
      userId: session?.sub ?? null,
    },
  });

  if (session) {
    await logActivity(session.sub, "bug_report.created", {
      bugReportId: report.id,
    });
  }

  return NextResponse.json({ report }, { status: 201 });
}
