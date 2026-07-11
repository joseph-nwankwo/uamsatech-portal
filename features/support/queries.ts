import { db } from "@/lib/db";

export function getAllKnowledgeBaseArticles() {
  return db.knowledgeBaseArticle.findMany({ orderBy: { category: "asc" } });
}

export function getKnowledgeBaseArticle(slug: string) {
  return db.knowledgeBaseArticle.findUnique({ where: { slug } });
}

export async function getKnowledgeBaseCategories() {
  const articles = await db.knowledgeBaseArticle.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return articles.map((a) => a.category);
}

export function getOpenIncidents() {
  return db.incident.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: { startedAt: "desc" },
  });
}

export function getRecentIncidents(limit = 10) {
  return db.incident.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export function getFeatureRequests() {
  return db.featureRequest.findMany({
    include: { user: true, votes: true },
    orderBy: { createdAt: "desc" },
  });
}
