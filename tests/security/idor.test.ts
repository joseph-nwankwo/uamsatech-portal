import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  BASE_URL,
  createTestUser,
  authHeaders,
  type TestUser,
} from "./helpers";

// A real, seeded, permanent blog post (Phase 10) — safe to comment on
// repeatedly since these tests always clean up what they create.
const BLOG_SLUG = "building-for-africa-first";

describe("cross-user resource access (IDOR)", () => {
  let userA: TestUser;
  let userB: TestUser;
  let commentId: string;

  it("lets a user create their own comment", async () => {
    userA = await createTestUser("idor-a");
    userB = await createTestUser("idor-b");

    const res = await fetch(`${BASE_URL}/api/blog/${BLOG_SLUG}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(userA) },
      body: JSON.stringify({ content: "IDOR test comment — safe to delete." }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { comment: { id: string } };
    commentId = body.comment.id;
    expect(commentId).toBeTruthy();
  });

  it("blocks a different user from deleting someone else's comment", async () => {
    const res = await fetch(`${BASE_URL}/api/blog/comments/${commentId}`, {
      method: "DELETE",
      headers: authHeaders(userB),
    });
    expect(res.status).toBe(403);
  });

  it("confirms the comment still exists after the blocked attempt", async () => {
    const comment = await db.comment.findUnique({ where: { id: commentId } });
    expect(comment).not.toBeNull();
  });

  it("lets the owning user delete their own comment", async () => {
    const res = await fetch(`${BASE_URL}/api/blog/comments/${commentId}`, {
      method: "DELETE",
      headers: authHeaders(userA),
    });
    expect(res.status).toBe(200);
  });

  afterAll(async () => {
    await db.comment.deleteMany({ where: { id: commentId } });
    if (userA)
      await db.user
        .delete({ where: { id: userA.userId } })
        .catch(() => undefined);
    if (userB)
      await db.user
        .delete({ where: { id: userB.userId } })
        .catch(() => undefined);
  });
});
