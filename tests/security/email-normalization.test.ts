import { describe, it, expect, inject, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { BASE_URL } from "./helpers";

// S1 regression: emails are normalized on every write and lookup, and /admin
// needs a verified, allowlisted account loaded from the DB.
//
// Signup budget: this file makes exactly 2 HTTP signups (5/hour per IP is
// shared with global-setup and injection.test.ts — see global-setup.ts).
//
// The admin cases need TEST_ADMIN_EMAIL in the *server's* ADMIN_EMAILS
// (.env locally, ci.yml in CI). Test-only; never in production.

const TEST_ADMIN_EMAIL = "security-admin@example.com";
const DUPLICATE_BODY = { error: "An account with this email already exists." };
const ADMIN_ROUTES = [
  "/admin",
  "/admin/revenue",
  "/admin/customers",
  "/admin/marketing",
  "/admin/product",
  "/admin/conversion",
  "/admin/feature-flags",
];

const allowlisted = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(normalizeEmail)
  .includes(TEST_ADMIN_EMAIL);

function accessTokenFrom(res: Response): string | null {
  for (const c of res.headers.getSetCookie()) {
    const m = c.match(/^access_token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

function signup(email: string) {
  return fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Security Test",
      email,
      password: "TestPass123!",
    }),
  });
}

describe("email normalization (S1)", () => {
  const shared = inject("sharedUser");
  const variant = (email: string) => `  ${email.toUpperCase()} `;

  it("rejects signup with a case/whitespace variant of an existing email, exactly like a duplicate", async () => {
    const res = await signup(variant(shared.email));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(DUPLICATE_BODY);
    expect(
      await db.user.count({
        where: { email: { equals: shared.email, mode: "insensitive" } },
      })
    ).toBe(1);
  });

  it("logs in with different casing and surrounding whitespace", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: variant(shared.email),
        password: shared.password,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.id).toBe(shared.userId);
    expect(body.user.email).toBe(normalizeEmail(shared.email));
  });
});

describe.skipIf(!allowlisted)(
  "/admin gate with an allowlisted address (S1)",
  () => {
    let userId: string | undefined;
    let accessToken: string;

    beforeAll(async () => {
      // A leftover from an interrupted earlier run would make signup 409.
      await db.user.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });

      const res = await signup("  Security-Admin@Example.COM ");
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        user: { id: string; email: string };
      };
      userId = body.user.id;
      expect(body.user.email).toBe(TEST_ADMIN_EMAIL);
      accessToken = accessTokenFrom(res)!;
      expect(accessToken).toBeTruthy();
    });

    afterAll(async () => {
      if (userId) await db.user.deleteMany({ where: { id: userId } });
    });

    const get = (route: string) =>
      fetch(`${BASE_URL}${route}`, {
        headers: { Cookie: `access_token=${accessToken}` },
        redirect: "manual",
      });

    it("stores the signup email normalized", async () => {
      const row = await db.user.findUnique({ where: { id: userId } });
      expect(row?.email).toBe(TEST_ADMIN_EMAIL);
      expect(row?.emailVerified).toBeNull();
    });

    it("gives a freshly signed-up, unverified allowlisted account no /admin access", async () => {
      for (const route of ADMIN_ROUTES) {
        const res = await get(route);
        expect(res.status, route).toBe(404);
      }
    });

    it("positive control: the same account gets in once emailVerified is set (read from the DB, same token)", async () => {
      await db.user.update({
        where: { id: userId },
        data: { emailVerified: new Date() },
      });
      const res = await get("/admin/revenue");
      expect(res.status).toBe(200);
    });
  }
);
