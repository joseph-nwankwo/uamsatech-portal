import type { Metadata } from "next";
import { H1, Muted } from "@/components/ui/typography";
import { SupportTicketsManager } from "@/features/portal/components/support-tickets-manager";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function PortalSupportPage() {
  const { user } = await getPortalContext();

  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <H1 className="text-2xl sm:text-2xl">Support</H1>
      <Muted className="mt-1">
        Open a ticket and message us directly — replies show up right here.
      </Muted>

      <div className="mt-8">
        <SupportTicketsManager
          tickets={tickets.map((t) => ({
            id: t.id,
            subject: t.subject,
            status: t.status,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
