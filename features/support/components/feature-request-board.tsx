"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowBigUp, Plus, Sparkles } from "lucide-react";
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

export type FeatureRequestItem = {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "PLANNED" | "IN_PROGRESS" | "SHIPPED" | "CLOSED";
  createdAt: string;
  voteCount: number;
  hasVoted: boolean;
  submittedBy: string;
};

const statusLabel: Record<FeatureRequestItem["status"], string> = {
  OPEN: "Open",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
  CLOSED: "Closed",
};

export function FeatureRequestBoard({
  requests,
  isLoggedIn,
}: {
  requests: FeatureRequestItem[];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  const sorted = [...requests].sort((a, b) => b.voteCount - a.voteCount);

  async function submitRequest() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/feature-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    setTitle("");
    setDescription("");
    router.refresh();
  }

  async function vote(id: string) {
    setVotingId(id);
    await fetch(`/api/feature-requests/${id}/vote`, { method: "POST" });
    router.refresh();
    setVotingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isLoggedIn ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  className="bg-navy hover:bg-navy/90 text-white"
                >
                  <Plus className="size-4" />
                  New request
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request a feature</DialogTitle>
                <DialogDescription>
                  Others will be able to see and vote on this.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="fr-title">Title</Label>
                <Input
                  id="fr-title"
                  placeholder="e.g. Self-serve plan downgrades"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fr-description">Description</Label>
                <Textarea
                  id="fr-description"
                  rows={4}
                  placeholder="What would this let you do?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <DialogFooter>
                <Button
                  className="bg-navy hover:bg-navy/90 text-white"
                  loading={submitting}
                  disabled={
                    title.trim().length < 5 || description.trim().length < 10
                  }
                  onClick={submitRequest}
                >
                  Submit request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                href={`/login?redirect_uri=${encodeURIComponent(pathname)}`}
              >
                Sign in to submit a request
              </Link>
            }
          />
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No requests yet"
          description="Be the first to suggest something."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((request) => (
            <div
              key={request.id}
              className="border-border flex gap-4 rounded-xl border p-4"
            >
              <button
                onClick={() =>
                  isLoggedIn
                    ? vote(request.id)
                    : router.push(
                        `/login?redirect_uri=${encodeURIComponent(pathname)}`
                      )
                }
                disabled={votingId === request.id}
                className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                  request.hasVoted
                    ? "border-navy bg-navy/10 text-navy dark:border-blue-accent dark:bg-blue-accent/15 dark:text-blue-accent"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowBigUp className="size-4" />
                {request.voteCount}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground text-sm font-medium">
                    {request.title}
                  </p>
                  <Badge variant="outline">{statusLabel[request.status]}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {request.description}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Suggested by {request.submittedBy}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
