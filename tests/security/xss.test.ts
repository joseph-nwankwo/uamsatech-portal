import { describe, it, expect, afterAll, inject } from "vitest";
import { db } from "@/lib/db";
import { BASE_URL, authHeaders } from "./helpers";

const BLOG_SLUG = "building-for-africa-first";
const PAYLOAD = "<script>alert(document.cookie)</script>";

describe("XSS: user-generated content must render escaped, never executable", () => {
  const user = inject("sharedUser");
  let commentId: string;

  it("accepts the raw payload on write (sanitize-on-render, not on-write)", async () => {
    const res = await fetch(`${BASE_URL}/api/blog/${BLOG_SLUG}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(user) },
      body: JSON.stringify({ content: PAYLOAD }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { comment: { id: string } };
    commentId = body.comment.id;
  });

  it("renders the payload HTML-escaped on the public blog page, not as a live tag", async () => {
    const page = await fetch(`${BASE_URL}/blog/${BLOG_SLUG}`);
    const html = await page.text();

    expect(html).not.toContain(PAYLOAD);
    expect(html).toContain("&lt;script&gt;");
  });

  afterAll(async () => {
    if (commentId) await db.comment.deleteMany({ where: { id: commentId } });
  });
});
