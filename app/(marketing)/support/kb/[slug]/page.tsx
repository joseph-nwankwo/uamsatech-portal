import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { H1 } from "@/components/ui/typography";
import {
  getAllKnowledgeBaseArticles,
  getKnowledgeBaseArticle,
} from "@/features/support/queries";

export async function generateStaticParams() {
  const articles = await getAllKnowledgeBaseArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getKnowledgeBaseArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    alternates: { canonical: `/support/kb/${article.slug}` },
  };
}

export default async function KnowledgeBaseArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getKnowledgeBaseArticle(slug);
  if (!article) notFound();

  const content = article.content as string[];

  return (
    <article className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <Link
        href="/support/kb"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to knowledge base
      </Link>

      <div className="mt-6">
        <Badge variant="outline">{article.category}</Badge>
      </div>

      <H1 className="mt-4 sm:text-4xl">{article.title}</H1>

      <div className="text-foreground mt-8 space-y-5">
        {content.map((paragraph, i) => (
          <p key={i} className="text-muted-foreground leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="border-border bg-card mt-12 rounded-2xl border p-6 text-sm">
        <p className="text-foreground font-medium">
          Didn&apos;t find your answer?
        </p>
        <p className="text-muted-foreground mt-1">
          <Link href="/contact" className="underline underline-offset-4">
            Contact us
          </Link>{" "}
          or, if you have an account,{" "}
          <Link href="/portal/support" className="underline underline-offset-4">
            open a support ticket
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
