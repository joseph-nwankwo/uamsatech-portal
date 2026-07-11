import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { H1, Lead } from "@/components/ui/typography";
import { getAllKnowledgeBaseArticles } from "@/features/support/queries";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description:
    "Self-service answers for common UAMSATech account and billing questions.",
  alternates: { canonical: "/support/kb" },
};

export default async function KnowledgeBasePage() {
  const articles = await getAllKnowledgeBaseArticles();

  const byCategory = new Map<string, typeof articles>();
  for (const article of articles) {
    const list = byCategory.get(article.category) ?? [];
    list.push(article);
    byCategory.set(article.category, list);
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <Link
        href="/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to support
      </Link>
      <H1 className="mt-6">Knowledge Base</H1>
      <Lead className="mt-4">
        Self-service answers for account, billing, and team questions.
      </Lead>

      <div className="mt-12 space-y-10">
        {[...byCategory.entries()].map(([category, items]) => (
          <div key={category}>
            <h2 className="text-foreground text-lg font-semibold">
              {category}
            </h2>
            <div className="border-border mt-4 divide-y divide-inherit rounded-2xl border">
              {items.map((article) => (
                <Link
                  key={article.slug}
                  href={`/support/kb/${article.slug}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-4 p-5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <BookOpen className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {article.title}
                      </p>
                      {article.excerpt && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {article.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
