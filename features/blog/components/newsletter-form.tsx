"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-3">
        <CheckCircle2 className="text-status-good size-5 shrink-0" />
        <p className="text-foreground text-sm">
          You&apos;re subscribed. We&apos;ll only email when there&apos;s
          something worth reading.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Mail className="text-navy dark:text-blue-accent size-5" />
        <h3 className="text-foreground font-semibold">
          Get new posts by email
        </h3>
      </div>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Occasional product updates and thinking on building academic software
        for Africa. Unsubscribe anytime.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        <Input
          type="email"
          required
          placeholder="you@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button
          type="submit"
          loading={isSubmitting}
          className="bg-navy hover:bg-navy/90 text-white"
        >
          Subscribe
        </Button>
      </form>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
    </div>
  );
}
