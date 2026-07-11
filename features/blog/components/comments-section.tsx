"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { displayName } from "@/features/blog/display-name";

export type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  // Deliberately no email — this renders on a public page, and a
  // commenter's email must never be shown unless they've explicitly chosen
  // to display it (they haven't; there's no such setting today).
  user: { id: string; name: string | null };
};

export function CommentsSection({
  slug,
  initialComments,
  currentUserId,
}: {
  slug: string;
  initialComments: CommentItem[];
  currentUserId: string | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const response = await fetch(`/api/blog/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Couldn't post your comment.");
      return;
    }

    setComments((prev) => [...prev, data.comment]);
    setContent("");
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/blog/comments/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div>
      <h2 className="text-foreground text-lg font-semibold">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>

      <div className="mt-6 space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="border-border border-b pb-6">
            <div className="flex items-center justify-between">
              <p className="text-foreground text-sm font-medium">
                {displayName(comment.user.name)}
              </p>
              <div className="flex items-center gap-2">
                <time className="text-muted-foreground text-xs">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </time>
                {currentUserId === comment.user.id && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(comment.id)}
                    aria-label="Delete comment"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mt-1.5 text-sm whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No comments yet — be the first to say something.
          </p>
        )}
      </div>

      <div className="mt-8">
        {currentUserId ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              required
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              type="submit"
              loading={isSubmitting}
              className="bg-navy hover:bg-navy/90 text-white"
            >
              Post comment
            </Button>
          </form>
        ) : (
          <p className="border-border rounded-lg border border-dashed p-4 text-center text-sm">
            <Link
              href={`/login?redirect_uri=${encodeURIComponent(`/blog/${slug}`)}`}
              className="text-foreground font-medium underline"
            >
              Sign in
            </Link>{" "}
            <span className="text-muted-foreground">to leave a comment.</span>
          </p>
        )}
      </div>
    </div>
  );
}
