import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `comment-delete:${session.sub}`,
    30,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  const { id } = await params;
  const comment = await db.comment.findUnique({ where: { id } });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (comment.userId !== session.sub) {
    return NextResponse.json(
      { error: "You can only delete your own comments." },
      { status: 403 }
    );
  }

  await db.comment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
