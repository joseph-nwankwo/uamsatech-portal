import type { MetadataRoute } from "next";
import { siteConfig, products } from "@/lib/site-config";
import {
  getAllCategories,
  getAllTags,
  getPublishedPosts,
} from "@/features/blog/queries";
import { allDocs } from "@/features/docs";
import { getAllKnowledgeBaseArticles } from "@/features/support/queries";

const staticRoutes = [
  "",
  "/about",
  "/products",
  "/solutions",
  "/pricing",
  "/customers",
  "/blog",
  "/docs",
  "/careers",
  "/contact",
  "/support",
  "/support/kb",
  "/support/bug-report",
  "/feature-requests",
  "/privacy",
  "/terms",
  "/status",
];

// Bump this only when marketing/product page content actually changes —
// not on every build. Using the real request time here would tell crawlers
// every page changes on every visit, which is false and hurts re-crawl
// prioritization rather than helping it.
const CONTENT_LAST_UPDATED = new Date("2026-07-07");

// Same bug class caught on the Phase 11 status page: this route queries the
// DB (blog posts, KB articles) but has no dynamic API, so Next prerenders it
// once at build time by default — a new blog post or KB article wouldn't
// appear here until the next deploy. Hourly revalidation is enough for a
// sitemap (crawlers don't need second-level freshness).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags, kbArticles] = await Promise.all([
    getPublishedPosts(),
    getAllCategories(),
    getAllTags(),
    getAllKnowledgeBaseArticles(),
  ]);

  const staticEntries = staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: CONTENT_LAST_UPDATED,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  const productEntries = products.map((product) => ({
    url: `${siteConfig.url}/products/${product.slug}`,
    lastModified: CONTENT_LAST_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const blogEntries = posts.map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}`,
    lastModified: post.publishedAt ?? CONTENT_LAST_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const blogCategoryEntries = categories.map((category) => ({
    url: `${siteConfig.url}/blog/category/${category.slug}`,
    lastModified: CONTENT_LAST_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.4,
  }));

  const blogTagEntries = tags.map((tag) => ({
    url: `${siteConfig.url}/blog/tag/${tag.slug}`,
    lastModified: CONTENT_LAST_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.3,
  }));

  const docsEntries = allDocs.map((doc) => ({
    url: `${siteConfig.url}/docs/${doc.category}/${doc.slug}`,
    lastModified: CONTENT_LAST_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const kbEntries = kbArticles.map((article) => ({
    url: `${siteConfig.url}/support/kb/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...productEntries,
    ...blogEntries,
    ...blogCategoryEntries,
    ...blogTagEntries,
    ...docsEntries,
    ...kbEntries,
  ];
}
