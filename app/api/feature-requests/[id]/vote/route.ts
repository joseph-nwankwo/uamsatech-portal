import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `feature-vote:${session.sub}`,
    60,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  const { id } = await params;
  const featureRequest = await db.featureRequest.findUnique({
    where: { id },
  });
  if (!featureRequest) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const existing = await db.featureRequestVote.findUnique({
    where: {
      featureRequestId_userId: { featureRequestId: id, userId: session.sub },
    },
  });

  if (existing) {
    await db.featureRequestVote.delete({ where: { id: existing.id } });
    return NextResponse.json({ voted: false });
  }

  await db.featureRequestVote.create({
    data: { featureRequestId: id, userId: session.sub },
  });
  await logActivity(session.sub, "feature_request.voted", {
    featureRequestId: id,
  });

  return NextResponse.json({ voted: true });
}
