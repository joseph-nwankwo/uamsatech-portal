import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { H1, Lead } from "@/components/ui/typography";
import { PostCard } from "@/features/blog/components/post-card";
import {
  getAllCategories,
  getCategory,
  getPostsByCategory,
} from "@/features/blog/queries";

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  return {
    title: `${category.name} — Blog`,
    description:
      category.description ??
      `Posts about ${category.name} from the UAMSATech blog.`,
    alternates: { canonical: `/blog/category/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const posts = await getPostsByCategory(slug);

  return (
    <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <Link
        href="/blog"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to blog
      </Link>
      <H1 className="mt-6">{category.name}</H1>
      {category.description && (
        <Lead className="mt-4">{category.description}</Lead>
      )}

      <div className="divide-border border-border mt-8 divide-y border-t">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
        {posts.length === 0 && (
          <p className="text-muted-foreground py-8 text-sm">
            No posts in this category yet.
          </p>
        )}
      </div>
    </section>
  );
}
