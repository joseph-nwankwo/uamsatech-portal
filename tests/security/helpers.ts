// Shared helpers for tests/security/**. These hit a real running server —
// default http://localhost:3000, override with TEST_BASE_URL (CI points
// this at the built/started app; see .github/workflows/ci.yml). No mocks:
// same "verify the real thing" approach used for every manual E2E pass this
// project's phases have run.
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function extractCookie(response: Response, name: string): string | null {
  // undici/fetch exposes multiple Set-Cookie headers via getSetCookie() in
  // modern Node; fall back to a single header split for older runtimes.
  const raw =
    "getSetCookie" in response.headers &&
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (response.headers.get("set-cookie")?.split(/,(?=[^;]+?=)/) ?? []);

  for (const cookie of raw) {
    const match = cookie.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

export type TestUser = {
  email: string;
  password: string;
  accessToken: string;
  userId: string;
};

/** Signs up a fresh, real throwaway account and returns its access token. */
export async function createTestUser(prefix = "sectest"): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const password = "TestPass123!";

  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Security Test", email, password }),
  });
  if (!signupRes.ok) {
    throw new Error(`Signup failed for ${email}: ${signupRes.status}`);
  }
  const signupBody = (await signupRes.json()) as { user: { id: string } };

  const accessToken = extractCookie(signupRes, "access_token");
  if (!accessToken) {
    throw new Error("Signup succeeded but no access_token cookie was set.");
  }

  return { email, password, accessToken, userId: signupBody.user.id };
}

/**
 * Creates a throwaway account directly in the DB and mints an access token
 * for it with the server's AUTH_JWT_SECRET (same .env). Use this when a test
 * needs an identity but isn't testing signup itself: HTTP signup is limited
 * to 5/hour per IP and the suite's signup budget is reserved for tests that
 * exercise /api/auth/signup. Callers must delete the user in teardown.
 */
export async function createDbTestUser(prefix = "sectest"): Promise<TestUser> {
  // Imported lazily: lib/env parses process.env at load time, and the
  // global setup loads .env before importing this module's DB users.
  const { db } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/auth/passwords");
  const { signAccessToken } = await import("@/lib/auth/jwt");

  const email = uniqueEmail(prefix);
  const password = "TestPass123!";
  const user = await db.user.create({
    data: {
      name: "Security Test",
      email,
      passwordHash: await hashPassword(password),
    },
  });
  const accessToken = await signAccessToken({ sub: user.id });
  return { email, password, accessToken, userId: user.id };
}

export function authHeaders(user: TestUser): HeadersInit {
  return { Cookie: `access_token=${user.accessToken}` };
}
