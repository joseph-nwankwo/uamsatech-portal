import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { H1, Lead } from "@/components/ui/typography";
import { NewsletterForm } from "@/features/blog/components/newsletter-form";
import { PostCard } from "@/features/blog/components/post-card";
import {
  getAllCategories,
  getAllTags,
  getPublishedPosts,
} from "@/features/blog/queries";

export const metadata: Metadata = {
  title: "Blog",
  description: "News, product updates, and insights from UAMSATech.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const [posts, categories, tags] = await Promise.all([
    getPublishedPosts(),
    getAllCategories(),
    getAllTags(),
  ]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <H1>Blog</H1>
          <Lead className="mt-4">
            Product updates and thinking on building academic software for
            Africa.
          </Lead>
        </div>
        <Link
          href="/blog/rss.xml"
          className="text-muted-foreground hover:text-foreground text-sm font-medium underline underline-offset-4"
        >
          RSS feed
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Link key={category.slug} href={`/blog/category/${category.slug}`}>
            <Badge variant="outline">{category.name}</Badge>
          </Link>
        ))}
        {tags.map((tag) => (
          <Link key={tag.slug} href={`/blog/tag/${tag.slug}`}>
            <Badge className="bg-secondary text-secondary-foreground">
              #{tag.name}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="divide-border border-border mt-8 divide-y border-t">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      <div className="border-border mt-16 rounded-2xl border p-8">
        <NewsletterForm />
      </div>
    </section>
  );
}
