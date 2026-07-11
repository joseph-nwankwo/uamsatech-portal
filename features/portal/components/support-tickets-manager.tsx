"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";

export type TicketSummary = {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
};

const statusVariant: Record<TicketSummary["status"], "default" | "outline"> = {
  OPEN: "default",
  IN_PROGRESS: "default",
  RESOLVED: "outline",
  CLOSED: "outline",
};

export function SupportTicketsManager({
  tickets,
}: {
  tickets: TicketSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTicket() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/portal/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    setSubject("");
    setMessage("");
    router.push(`/portal/support/${data.ticket.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="bg-navy hover:bg-navy/90 text-white">
                <Plus className="size-4" />
                New ticket
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open a support ticket</DialogTitle>
              <DialogDescription>
                Tell us what&apos;s going on — you can keep messaging us on this
                ticket after it&apos;s opened.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                placeholder="e.g. Can't invite a new team member"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-message">Message</Label>
              <Textarea
                id="ticket-message"
                rows={4}
                placeholder="Describe the issue in as much detail as you can..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button
                className="bg-navy hover:bg-navy/90 text-white"
                loading={creating}
                disabled={
                  subject.trim().length < 3 || message.trim().length < 10
                }
                onClick={createTicket}
              >
                Open ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No support tickets yet"
          description="Open one whenever you run into an issue — we'll reply right here."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/portal/support/${ticket.id}`}
              className="border-border hover:bg-muted/50 flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
            >
              <div>
                <p className="text-foreground text-sm font-medium">
                  {ticket.subject}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Opened {new Date(ticket.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={statusVariant[ticket.status]}>
                {ticket.status.replace("_", " ")}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
