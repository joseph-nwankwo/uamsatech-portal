import { db } from "@/lib/db";

const publishedWhere = { publishedAt: { lte: new Date() } } as const;

const postSummaryInclude = {
  author: true,
  category: true,
  tags: true,
} as const;

export function getPublishedPosts() {
  return db.blogPost.findMany({
    where: publishedWhere,
    include: postSummaryInclude,
    orderBy: { publishedAt: "desc" },
  });
}

export function getPostBySlug(slug: string) {
  return db.blogPost.findFirst({
    where: { slug, ...publishedWhere },
    include: {
      author: true,
      category: true,
      tags: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export function getPostsByCategory(categorySlug: string) {
  return db.blogPost.findMany({
    where: { category: { slug: categorySlug }, ...publishedWhere },
    include: postSummaryInclude,
    orderBy: { publishedAt: "desc" },
  });
}

export function getPostsByTag(tagSlug: string) {
  return db.blogPost.findMany({
    where: { tags: { some: { slug: tagSlug } }, ...publishedWhere },
    include: postSummaryInclude,
    orderBy: { publishedAt: "desc" },
  });
}

export function getCategory(slug: string) {
  return db.category.findUnique({ where: { slug } });
}

export function getTag(slug: string) {
  return db.tag.findUnique({ where: { slug } });
}

export function getAllCategories() {
  return db.category.findMany({ orderBy: { name: "asc" } });
}

export function getAllTags() {
  return db.tag.findMany({ orderBy: { name: "asc" } });
}

export async function getRelatedPosts(
  postId: string,
  categoryId: string | null,
  tagIds: string[],
  limit = 3
) {
  if (!categoryId && tagIds.length === 0) return [];

  const related = await db.blogPost.findMany({
    where: {
      id: { not: postId },
      ...publishedWhere,
      OR: [
        ...(categoryId ? [{ categoryId }] : []),
        ...(tagIds.length > 0
          ? [{ tags: { some: { id: { in: tagIds } } } }]
          : []),
      ],
    },
    include: postSummaryInclude,
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return related;
}
