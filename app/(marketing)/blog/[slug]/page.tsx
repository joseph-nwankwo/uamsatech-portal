import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { H1 } from "@/components/ui/typography";
import { CommentsSection } from "@/features/blog/components/comments-section";
import { PostCard } from "@/features/blog/components/post-card";
import {
  getPostBySlug,
  getPublishedPosts,
  getRelatedPosts,
} from "@/features/blog/queries";
import { getSession } from "@/lib/auth/session";

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, session] = await Promise.all([
    getPostBySlug(slug),
    getSession(),
  ]);
  if (!post) notFound();

  const relatedPosts = await getRelatedPosts(
    post.id,
    post.categoryId,
    post.tags.map((t) => t.id)
  );

  const content = post.content as string[];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: post.author
      ? { "@type": "Organization", name: post.author.name }
      : undefined,
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Link
        href="/blog"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Back to blog
      </Link>

      <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-3 text-sm">
        {post.category && (
          <Link href={`/blog/category/${post.category.slug}`}>
            <Badge variant="outline">{post.category.name}</Badge>
          </Link>
        )}
        {post.publishedAt && (
          <time dateTime={post.publishedAt.toISOString()}>
            {post.publishedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        )}
      </div>

      <H1 className="mt-4 sm:text-4xl">{post.title}</H1>

      {post.author && (
        <div className="mt-4 flex items-center gap-3">
          <span className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold">
            {post.author.initials}
          </span>
          <div>
            <p className="text-foreground text-sm font-medium">
              {post.author.name}
            </p>
            {post.author.title && (
              <p className="text-muted-foreground text-xs">
                {post.author.title}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="text-foreground mt-8 space-y-5">
        {content.map((paragraph, i) => (
          <p key={i} className="text-muted-foreground leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Link key={tag.slug} href={`/blog/tag/${tag.slug}`}>
              <Badge className="bg-secondary text-secondary-foreground">
                #{tag.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {relatedPosts.length > 0 && (
        <div className="border-border mt-16 border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">
            Related posts
          </h2>
          <div className="divide-border divide-y">
            {relatedPosts.map((related) => (
              <PostCard key={related.slug} post={related} />
            ))}
          </div>
        </div>
      )}

      <div className="border-border mt-16 border-t pt-8">
        <CommentsSection
          slug={post.slug}
          initialComments={post.comments.map((c) => ({
            id: c.id,
            content: c.content,
            createdAt: c.createdAt.toISOString(),
            user: { id: c.user.id, name: c.user.name },
          }))}
          currentUserId={session?.sub ?? null}
        />
      </div>
    </article>
  );
}
