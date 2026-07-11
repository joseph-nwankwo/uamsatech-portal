"use client";

import { useState } from "react";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type TicketMessageItem = {
  id: string;
  author: "USER" | "STAFF";
  content: string;
  createdAt: string;
  user: { name: string | null; email: string } | null;
};

export function TicketThread({
  ticketId,
  initialMessages,
}: {
  ticketId: string;
  initialMessages: TicketMessageItem[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const response = await fetch(
      `/api/portal/support/tickets/${ticketId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    const data = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Couldn't send your message.");
      return;
    }

    setMessages((prev) => [...prev, data.message]);
    setContent("");
  }

  return (
    <div>
      <div className="space-y-4">
        {messages.map((message) => {
          const isStaff = message.author === "STAFF";
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isStaff ? "" : "flex-row-reverse"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isStaff
                    ? "bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {isStaff ? <Headset className="size-3.5" /> : "You"}
              </span>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  isStaff ? "bg-muted text-foreground" : "bg-navy text-white"
                }`}
              >
                {isStaff && (
                  <p className="mb-1 text-xs font-medium opacity-70">
                    UAMSATech Support
                  </p>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`mt-1 text-[11px] ${isStaff ? "text-muted-foreground" : "text-white/70"}`}
                >
                  {new Date(message.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Send a message..."
          rows={3}
          required
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          type="submit"
          loading={isSubmitting}
          className="bg-navy hover:bg-navy/90 text-white"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
