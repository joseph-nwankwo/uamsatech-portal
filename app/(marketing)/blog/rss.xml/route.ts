import { siteConfig } from "@/lib/site-config";
import { getPublishedPosts } from "@/features/blog/queries";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getPublishedPosts();

  const items = posts
    .map((post) => {
      const url = `${siteConfig.url}/blog/${post.slug}`;
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.excerpt ?? "")}</description>
      ${post.publishedAt ? `<pubDate>${post.publishedAt.toUTCString()}</pubDate>` : ""}
      ${post.author ? `<author>${escapeXml(post.author.name)}</author>` : ""}
      ${post.category ? `<category>${escapeXml(post.category.name)}</category>` : ""}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteConfig.name)} Blog</title>
    <link>${siteConfig.url}/blog</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>en-us</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // A feed reader polling every few minutes shouldn't hit the DB every
      // time — cache at the edge/CDN for 10 minutes, serve stale for up to
      // an hour while revalidating in the background.
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
