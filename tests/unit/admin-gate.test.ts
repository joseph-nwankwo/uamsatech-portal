import { describe, it, expect, vi, beforeEach } from "vitest";

// S1 — normalizeEmail and the /admin gate (lib/admin/auth.ts).

const envState: Record<string, string | undefined> = {};
vi.mock("@/lib/env", () => ({
  env: new Proxy({}, { get: (_t, k: string) => envState[k] }),
}));

let session: { sub: string } | null = null;
let dbUser: { id: string; email: string; emailVerified: Date | null } | null =
  null;
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        dbUser && dbUser.id === where.id ? dbUser : null,
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
// next/navigation throws to abort rendering; mirror that.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const { normalizeEmail, emailField } =
  await import("@/lib/auth/normalize-email");
const { parseAdminEmails, isAdminUser, getAdminContext, requireAdminApi } =
  await import("@/lib/admin/auth");

const VERIFIED = new Date("2026-01-01T00:00:00Z");

describe("normalizeEmail", () => {
  it.each([
    ["admin@example.com", "admin@example.com"],
    ["  Admin@Example.COM ", "admin@example.com"],
    ["\tUSER@X.IO\n", "user@x.io"],
    ["", ""],
  ])("%j -> %j", (input, out) => {
    expect(normalizeEmail(input)).toBe(out);
  });

  it("emailField normalizes before validating", () => {
    expect(emailField().parse("  Admin@Example.COM ")).toBe(
      "admin@example.com"
    );
    expect(emailField().safeParse("not-an-email").success).toBe(false);
    expect(emailField().safeParse("   ").success).toBe(false);
  });
});

describe("parseAdminEmails", () => {
  it("normalizes entries and drops blanks", () => {
    expect([...parseAdminEmails(" Admin@Example.COM, ,ops@x.io ,")]).toEqual([
      "admin@example.com",
      "ops@x.io",
    ]);
  });

  it.each([undefined, "", " , ,"])("%j is an empty allowlist", (raw) => {
    expect(parseAdminEmails(raw).size).toBe(0);
  });
});

describe("isAdminUser", () => {
  const allow = parseAdminEmails("admin@example.com");

  it("allows a verified, allowlisted user", () => {
    expect(
      isAdminUser(
        { email: "admin@example.com", emailVerified: VERIFIED },
        allow
      )
    ).toBe(true);
  });

  it("denies an unverified allowlisted user", () => {
    expect(
      isAdminUser({ email: "admin@example.com", emailVerified: null }, allow)
    ).toBe(false);
  });

  it("denies an unverified case variant of an allowlisted address", () => {
    expect(
      isAdminUser({ email: "ADMIN@EXAMPLE.COM", emailVerified: null }, allow)
    ).toBe(false);
  });

  it("denies a verified non-allowlisted user", () => {
    expect(
      isAdminUser(
        { email: "someone@example.com", emailVerified: VERIFIED },
        allow
      )
    ).toBe(false);
  });

  it("denies a missing user", () => {
    expect(isAdminUser(null, allow)).toBe(false);
  });

  it.each([undefined, "", " , "])(
    "ADMIN_EMAILS=%j grants admin to no one (fail closed)",
    (raw) => {
      expect(
        isAdminUser(
          { email: "admin@example.com", emailVerified: VERIFIED },
          parseAdminEmails(raw)
        )
      ).toBe(false);
    }
  );
});

describe("getAdminContext / requireAdminApi (DB user, not JWT)", () => {
  beforeEach(() => {
    envState.ADMIN_EMAILS = "admin@example.com";
    session = { sub: "u1" };
    dbUser = { id: "u1", email: "admin@example.com", emailVerified: VERIFIED };
  });

  it("returns the DB user for a verified allowlisted account", async () => {
    expect((await getAdminContext()).user.id).toBe("u1");
    const api = await requireAdminApi();
    expect(api.ok).toBe(true);
  });

  it("redirects to /login with no session", async () => {
    session = null;
    await expect(getAdminContext()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("404s an unverified allowlisted account", async () => {
    dbUser!.emailVerified = null;
    await expect(getAdminContext()).rejects.toThrow("NEXT_NOT_FOUND");
    const api = await requireAdminApi();
    expect(api.ok).toBe(false);
    if (!api.ok) expect(api.response.status).toBe(404);
  });

  it("404s when the session's user no longer exists", async () => {
    dbUser = null;
    await expect(getAdminContext()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([undefined, ""])("404s everyone when ADMIN_EMAILS=%j", async (v) => {
    envState.ADMIN_EMAILS = v;
    await expect(getAdminContext()).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await requireAdminApi()).ok).toBe(false);
  });
});
