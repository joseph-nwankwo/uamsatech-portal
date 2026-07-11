import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { H1, Lead } from "@/components/ui/typography";
import { BugReportForm } from "@/features/support/components/bug-report-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Report a Bug",
  description: "Found something broken? Let us know.",
  alternates: { canonical: "/support/bug-report" },
};

export default async function BugReportPage() {
  const session = await getSession();

  return (
    <section className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <Link
        href="/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to support
      </Link>
      <H1 className="mt-6">Report a bug</H1>
      <Lead className="mt-4">
        The more detail you give us, the faster we can track it down.
      </Lead>

      <div className="border-border bg-card mt-10 rounded-2xl border p-8">
        <BugReportForm isLoggedIn={!!session} />
      </div>
    </section>
  );
}
