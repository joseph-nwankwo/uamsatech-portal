import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { H1, Lead } from "@/components/ui/typography";
import { PostCard } from "@/features/blog/components/post-card";
import { getAllTags, getPostsByTag, getTag } from "@/features/blog/queries";

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug);
  if (!tag) return {};
  return {
    title: `#${tag.name} — Blog`,
    description: `Posts tagged #${tag.name} from the UAMSATech blog.`,
    alternates: { canonical: `/blog/tag/${tag.slug}` },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await getTag(slug);
  if (!tag) notFound();

  const posts = await getPostsByTag(slug);

  return (
    <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <Link
        href="/blog"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to blog
      </Link>
      <H1 className="mt-6">#{tag.name}</H1>
      <Lead className="mt-4">Posts tagged #{tag.name}.</Lead>

      <div className="divide-border border-border mt-8 divide-y border-t">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
        {posts.length === 0 && (
          <p className="text-muted-foreground py-8 text-sm">
            No posts with this tag yet.
          </p>
        )}
      </div>
    </section>
  );
}
