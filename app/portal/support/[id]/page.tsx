import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { H1 } from "@/components/ui/typography";
import { TicketThread } from "@/features/portal/components/ticket-thread";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Ticket",
  robots: { index: false, follow: false },
};

export default async function PortalTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getPortalContext();

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket || ticket.userId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/portal/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to support
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <H1 className="text-2xl sm:text-2xl">{ticket.subject}</H1>
        <Badge variant={ticket.status === "OPEN" ? "default" : "outline"}>
          {ticket.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="mt-8">
        <TicketThread
          ticketId={ticket.id}
          initialMessages={ticket.messages.map((m) => ({
            id: m.id,
            author: m.author,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            user: m.user ? { name: m.user.name, email: m.user.email } : null,
          }))}
        />
      </div>
    </div>
  );
}
