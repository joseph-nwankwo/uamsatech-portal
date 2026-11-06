import { describe, it, expect, vi, beforeEach } from "vitest";

// AS-P0-SECURITY-006A — POST /api/internal/entitlements/verify
// (server-to-server central entitlement decision for product backends).

const LS_SECRET = "lecturesuite-entitlement-service-secret-0123456789";
const SS_SECRET = "scholarsuite-entitlement-service-secret-0123456789";

const envState: Record<string, string | undefined> = {};
vi.mock("@/lib/env", () => ({
  env: new Proxy({}, { get: (_t, k: string) => envState[k] }),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: rateAllowed }),
  requestIp: () => "203.0.113.9",
}));
let rateAllowed = true;
const logs: { msg: string; ctx?: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logger: {
    info: (msg: string, ctx?: Record<string, unknown>) => logs.push({ msg, ctx }),
    warn: (msg: string, ctx?: Record<string, unknown>) => logs.push({ msg, ctx }),
    error: (msg: string, ctx?: Record<string, unknown>) => logs.push({ msg, ctx }),
    debug: () => undefined,
  },
}));

type Sub = { id: string; slug: string; userId: string | null; organizationId: string | null; status: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean };
let users: { id: string; email: string }[] = [];
let subs: Sub[] = [];
let memberships: { userId: string; organizationId: string }[] = [];
let dbFails = false;
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: async ({ where }: { where: { email: { equals: string } } }) => {
        if (dbFails) throw new Error("db down");
        return users.filter((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()).slice(0, 2).map((u) => ({ id: u.id }));
      },
    },
    subscription: {
      findMany: async ({ where }: { where: { product: { slug: { in: string[] } }; OR: [{ userId: string }, unknown] } }) => {
        const uid = where.OR[0].userId;
        const orgs = new Set(memberships.filter((m) => m.userId === uid).map((m) => m.organizationId));
        return subs
          .filter((s) => where.product.slug.in.includes(s.slug))
          .filter((s) => s.userId === uid || (s.organizationId !== null && orgs.has(s.organizationId)))
          .map((s) => ({ id: s.id, userId: s.userId, organizationId: s.organizationId, status: s.status, currentPeriodEnd: s.currentPeriodEnd, cancelAtPeriodEnd: s.cancelAtPeriodEnd }));
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const s = subs.find((x) => x.id === where.id);
        return s ? { currentPeriodEnd: s.currentPeriodEnd } : null;
      },
    },
  },
}));

const { POST } = await import("@/app/api/internal/entitlements/verify/route");

const DAY = 864e5;
const future = () => new Date(Date.now() + 30 * DAY);
const past = () => new Date(Date.now() - DAY);

function call(body: unknown, auth: string | null = `Bearer ${LS_SECRET}`) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth !== null) headers.authorization = auth;
  return POST(new Request("https://portal.test/api/internal/entitlements/verify", {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}
const ask = (email = "person@uni.edu", product = "lecturesuite") => ({ product, subject: { email } });

beforeEach(() => {
  envState.LECTURESUITE_ENTITLEMENT_SERVICE_SECRET = LS_SECRET;
  envState.SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET = SS_SECRET;
  rateAllowed = true;
  dbFails = false;
  logs.length = 0;
  users = [{ id: "u1", email: "person@uni.edu" }];
  memberships = [];
  subs = [{ id: "s1", slug: "lecturercraft", userId: "u1", organizationId: null, status: "ACTIVE", currentPeriodEnd: future(), cancelAtPeriodEnd: false }];
});

describe("service-to-service authentication", () => {
  it("rejects a request with no credential (401)", async () => {
    const res = await call(ask(), null);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it.each([["wrong secret", "Bearer not-the-right-secret-at-all-0123456789"], ["not a Bearer header", LS_SECRET], ["empty bearer", "Bearer "]])(
    "rejects %s (401)",
    async (_l, auth) => {
      expect((await call(ask(), auth)).status).toBe(401);
    }
  );

  it("binds a credential to ONE product: LectureSuite's secret cannot query ScholarSuite (401)", async () => {
    expect((await call(ask("person@uni.edu", "scholarsuite"), `Bearer ${LS_SECRET}`)).status).toBe(401);
    expect((await call(ask("person@uni.edu", "scholarsuite"), `Bearer ${SS_SECRET}`)).status).toBe(200);
  });

  it.each(["researchsuite", "lecturercraft", "uamsa", "__proto__", ""])("rejects unknown product %p (400)", async (product) => {
    expect((await call(ask("person@uni.edu", product))).status).toBe(400);
  });

  it("fails closed with 503 when the product's credential is not configured", async () => {
    envState.LECTURESUITE_ENTITLEMENT_SERVICE_SECRET = undefined;
    const res = await call(ask());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });

  it.each([["not JSON", "{oops"], ["missing subject", { product: "lecturesuite" }], ["invalid email", { product: "lecturesuite", subject: { email: "nope" } }]])(
    "rejects a malformed body: %s (400)",
    async (_l, body) => {
      expect((await call(body)).status).toBe(400);
    }
  );

  it("is rate limited (429) and never cached", async () => {
    const ok = await call(ask());
    expect(ok.headers.get("cache-control")).toBe("no-store");
    rateAllowed = false;
    expect((await call(ask())).status).toBe(429);
  });

  it("never logs the credential or the email", async () => {
    await call(ask());
    await call(ask(), "Bearer wrong-wrong-wrong-wrong-wrong-wrong");
    const text = JSON.stringify(logs);
    expect(text).not.toContain(LS_SECRET);
    expect(text).not.toContain("person@uni.edu");
  });
});

describe("decision — reuses the launch entitlement policy", () => {
  it("GRANTED/ACTIVE with the paid-through instant for a valid subscription", async () => {
    const res = await call(ask());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ v: 1, product: "lecturesuite", decision: "GRANTED", status: "ACTIVE", reason: null });
    expect(new Date(body.paidThrough).getTime()).toBe(subs[0].currentPeriodEnd!.getTime());
    expect(typeof body.decidedAt).toBe("string");
  });

  it("matches the account email case-insensitively", async () => {
    expect((await (await call(ask("PERSON@UNI.EDU"))).json()).decision).toBe("GRANTED");
  });

  it.each([
    ["expired paid-through", { currentPeriodEnd: past() }, "EXPIRED", "expired"],
    ["no paid-through date", { currentPeriodEnd: null }, "DENIED", "period_end_unknown"],
    ["TRIALING (no explicit central trial grant)", { status: "TRIALING" }, "DENIED", "trial_not_authorized"],
    ["PAST_DUE", { status: "PAST_DUE" }, "DENIED", "past_due"],
    ["CANCELED", { status: "CANCELED" }, "DENIED", "canceled"],
  ])("DENIED for %s", async (_l, over, status, reason) => {
    Object.assign(subs[0], over);
    const body = await (await call(ask())).json();
    expect(body).toMatchObject({ decision: "DENIED", status, reason, paidThrough: null });
  });

  it("is product-specific: a LectureSuite subscription does not grant ScholarSuite", async () => {
    const body = await (await call(ask("person@uni.edu", "scholarsuite"), `Bearer ${SS_SECRET}`)).json();
    expect(body).toMatchObject({ decision: "DENIED", status: "NONE", reason: "no_subscription" });
  });

  it("an existing portal account without any subscription is DENIED (an account is not entitlement)", async () => {
    subs = [];
    expect(await (await call(ask())).json()).toMatchObject({ decision: "DENIED", status: "NONE" });
  });

  it("an email with no portal account is DENIED", async () => {
    expect(await (await call(ask("stranger@uni.edu"))).json()).toMatchObject({ decision: "DENIED", reason: "no_account" });
  });

  it("an email matching two portal accounts case-insensitively is DENIED, not guessed", async () => {
    users.push({ id: "u2", email: "Person@uni.edu" });
    expect(await (await call(ask())).json()).toMatchObject({ decision: "DENIED", reason: "ambiguous_account" });
  });

  it("institution access follows the existing product-specific organization licence rule", async () => {
    subs = [{ id: "org-s", slug: "lecturercraft", userId: null, organizationId: "org-1", status: "ACTIVE", currentPeriodEnd: future(), cancelAtPeriodEnd: false }];
    expect((await (await call(ask())).json()).decision).toBe("DENIED"); // not a member
    memberships = [{ userId: "u1", organizationId: "org-1" }];
    expect((await (await call(ask())).json()).decision).toBe("GRANTED");
  });

  it("a decision failure is 503 'unavailable' — never a grant", async () => {
    dbFails = true;
    const res = await call(ask());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});

describe("portal env: entitlement service secrets", () => {
  it("must be ≥ 32 chars, differ from the launch/session secrets and from each other", async () => {
    const saved = { ...process.env };
    Object.assign(process.env, {
      DATABASE_URL: "postgresql://x", AUTH_JWT_SECRET: "a".repeat(40), CRAFT_LAUNCH_SECRET: "b".repeat(40),
    });
    vi.resetModules();
    const { envSchema } = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
    process.env = saved;
    const base = { DATABASE_URL: "postgresql://x", AUTH_JWT_SECRET: "a".repeat(40), CRAFT_LAUNCH_SECRET: "b".repeat(40) };
    expect(envSchema.safeParse(base).success).toBe(true); // optional
    expect(envSchema.safeParse({ ...base, LECTURESUITE_ENTITLEMENT_SERVICE_SECRET: LS_SECRET, SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET: SS_SECRET }).success).toBe(true);
    expect(envSchema.safeParse({ ...base, LECTURESUITE_ENTITLEMENT_SERVICE_SECRET: "<generate-a-new-secret>" }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, LECTURESUITE_ENTITLEMENT_SERVICE_SECRET: "b".repeat(40) }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET: "a".repeat(40) }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, LECTURESUITE_ENTITLEMENT_SERVICE_SECRET: LS_SECRET, SCHOLARSUITE_ENTITLEMENT_SERVICE_SECRET: LS_SECRET }).success).toBe(false);
  });
});
