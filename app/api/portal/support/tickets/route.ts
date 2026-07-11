import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { logActivity } from "@/lib/portal/audit";

const ticketSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `ticket:${session.sub}`,
    5,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many tickets opened. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = ticketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const ticket = await db.supportTicket.create({
    data: {
      subject: parsed.data.subject,
      message: parsed.data.message,
      userId: session.sub,
      messages: {
        create: {
          author: "USER",
          userId: session.sub,
          content: parsed.data.message,
        },
      },
    },
  });

  await logActivity(session.sub, "support_ticket.created", {
    ticketId: ticket.id,
    subject: ticket.subject,
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
