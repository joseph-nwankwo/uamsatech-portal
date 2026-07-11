import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Author, Category, Tag } from "@prisma/client";

export type PostSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  author: Author | null;
  category: Category | null;
  tags: Tag[];
};

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block py-8">
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
        {post.category && <Badge variant="outline">{post.category.name}</Badge>}
        {post.publishedAt && (
          <time dateTime={post.publishedAt.toISOString()}>
            {post.publishedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        )}
        {post.author && <span>&middot; {post.author.name}</span>}
      </div>
      <h2 className="text-foreground mt-3 text-xl font-semibold group-hover:underline">
        {post.title}
      </h2>
      {post.excerpt && (
        <p className="text-muted-foreground mt-2">{post.excerpt}</p>
      )}
    </Link>
  );
}
