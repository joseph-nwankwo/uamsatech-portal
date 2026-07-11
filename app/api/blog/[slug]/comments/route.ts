import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const commentSchema = z.object({
  content: z.string().min(2, "Say a little more").max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `comment:${session.sub}`,
    10,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "You're commenting too fast. Slow down a little." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { slug } = await params;
  const post = await db.blogPost.findUnique({ where: { slug } });
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const comment = await db.comment.create({
    data: {
      postId: post.id,
      userId: session.sub,
      content: parsed.data.content,
    },
    include: { user: true },
  });

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        // Never send email in a response rendered on a public page — see
        // features/blog/components/comments-section.tsx's displayName().
        user: { id: comment.user.id, name: comment.user.name },
      },
    },
    { status: 201 }
  );
}
