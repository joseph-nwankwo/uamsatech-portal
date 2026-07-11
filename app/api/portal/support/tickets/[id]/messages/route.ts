import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { logActivity } from "@/lib/portal/audit";

const messageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `ticket-message:${session.sub}`,
    20,
    60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "You're sending messages too fast. Slow down a little." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (ticket.userId !== session.sub) {
    return NextResponse.json(
      { error: "You can only message your own tickets." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const message = await db.ticketMessage.create({
    data: {
      ticketId: id,
      author: "USER",
      userId: session.sub,
      content: parsed.data.content,
    },
    select: {
      id: true,
      author: true,
      content: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    await db.supportTicket.update({
      where: { id },
      data: { status: "OPEN" },
    });
  }

  await logActivity(session.sub, "support_ticket.message_sent", {
    ticketId: id,
  });

  return NextResponse.json({ message }, { status: 201 });
}
