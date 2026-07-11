import type { Metadata } from "next";
import {
  ExternalLink,
  Mail,
  MessageSquare,
  FileText,
  Sparkles,
} from "lucide-react";
import { H1, H3, Muted } from "@/components/ui/typography";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Marketing Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminMarketingPage() {
  const [
    subscriberCount,
    activeSubscriberCount,
    contactCount,
    recentContacts,
    blogPostCount,
    commentCount,
    featureRequestCount,
    totalVotes,
  ] = await Promise.all([
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    db.contactMessage.count(),
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.blogPost.count(),
    db.comment.count(),
    db.featureRequest.count(),
    db.featureRequestVote.count(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">Marketing Dashboard</H1>
      <Muted className="mt-1">
        First-party funnel data this app actually has ground truth for.
      </Muted>

      <div className="border-navy/20 bg-navy/5 dark:border-blue-accent/20 dark:bg-blue-accent/5 mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
        <ExternalLink className="text-navy dark:text-blue-accent mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground">
          Traffic, sessions, and campaign attribution live in{" "}
          <a
            href="https://analytics.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Google Analytics
          </a>{" "}
          and{" "}
          <a
            href="https://clarity.microsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Microsoft Clarity
          </a>{" "}
          directly — this app has no server-side access to that data, so it
          isn&apos;t faked here. What&apos;s below is real, first-party data
          this app&apos;s own database actually has.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Mail className="size-3.5" />
            Newsletter subscribers
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {activeSubscriberCount}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              of {subscriberCount} ever subscribed
            </span>
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <MessageSquare className="size-3.5" />
            Contact form submissions
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {contactCount}
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <FileText className="size-3.5" />
            Blog posts &middot; comments
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {blogPostCount}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              &middot; {commentCount} comments
            </span>
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Sparkles className="size-3.5" />
            Feature requests &middot; votes
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {featureRequestCount}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              &middot; {totalVotes} votes
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8">
        <H3>Recent contact submissions</H3>
        <div className="mt-4">
          {recentContacts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No contact form submissions yet.
            </p>
          ) : (
            <div className="border-border divide-border divide-y rounded-xl border">
              {recentContacts.map((c) => (
                <div key={c.id} className="p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      {c.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {c.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">{c.email}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2">
                    {c.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
