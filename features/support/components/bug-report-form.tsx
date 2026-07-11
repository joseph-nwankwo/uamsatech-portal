"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { products } from "@/lib/site-config";

export function BugReportForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [productSlug, setProductSlug] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const res = await fetch("/api/support/bug-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        stepsToReproduce: stepsToReproduce || undefined,
        severity,
        productSlug,
        email: isLoggedIn ? undefined : email,
      }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-10 text-center">
        <CheckCircle2 className="text-navy dark:text-blue-accent size-10" />
        <h3 className="text-foreground text-lg font-semibold">
          Bug report submitted
        </h3>
        <p className="text-muted-foreground text-sm">
          Thanks for the detail — we&apos;ll take a look.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="bug-title">Summary</Label>
        <Input
          id="bug-title"
          placeholder="e.g. Invite link 404s after accepting"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bug-severity">Severity</Label>
          <Select value={severity} onValueChange={(v) => v && setSeverity(v)}>
            <SelectTrigger id="bug-severity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bug-product">Product (optional)</Label>
          <Select
            value={productSlug}
            onValueChange={(v) => setProductSlug(v ?? undefined)}
          >
            <SelectTrigger id="bug-product" className="w-full">
              <SelectValue placeholder="uamsatech.com" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-description">What happened?</Label>
        <Textarea
          id="bug-description"
          rows={4}
          placeholder="Describe the bug..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-steps">Steps to reproduce (optional)</Label>
        <Textarea
          id="bug-steps"
          rows={3}
          placeholder="1. Go to...&#10;2. Click...&#10;3. See error"
          value={stepsToReproduce}
          onChange={(e) => setStepsToReproduce(e.target.value)}
        />
      </div>

      {!isLoggedIn && (
        <div className="space-y-2">
          <Label htmlFor="bug-email">Your email</Label>
          <Input
            id="bug-email"
            type="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        type="submit"
        loading={isSubmitting}
        disabled={title.trim().length < 5 || description.trim().length < 10}
        className="bg-navy hover:bg-navy/90 text-white"
      >
        Submit bug report
      </Button>
    </form>
  );
}
