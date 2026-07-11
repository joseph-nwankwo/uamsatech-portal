import type { Metadata } from "next";
import { H1, Lead } from "@/components/ui/typography";
import { FeatureRequestBoard } from "@/features/support/components/feature-request-board";
import { getFeatureRequests } from "@/features/support/queries";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Feature Requests",
  description: "See what's been requested, and vote for what matters to you.",
  alternates: { canonical: "/feature-requests" },
};

export default async function FeatureRequestsPage() {
  const [requests, session] = await Promise.all([
    getFeatureRequests(),
    getSession(),
  ]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <H1>Feature Requests</H1>
      <Lead className="mt-4">
        Tell us what you&apos;d like to see next, and vote for the requests that
        matter most to you.
      </Lead>

      <div className="mt-10">
        <FeatureRequestBoard
          isLoggedIn={!!session}
          requests={requests.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            voteCount: r.votes.length,
            hasVoted: session
              ? r.votes.some((v) => v.userId === session.sub)
              : false,
            submittedBy: r.user.name ?? "A UAMSATech user",
          }))}
        />
      </div>
    </section>
  );
}
