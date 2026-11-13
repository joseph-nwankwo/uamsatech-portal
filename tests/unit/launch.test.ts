import { describe, it, expect, vi, beforeEach } from "vitest";
import { jwtVerify, decodeProtectedHeader } from "jose";

// AS-P0-SECURITY-002 — SSO launch token signing and the portal launch route.

const LAUNCH_SECRET = "test-craft-launch-secret-min-32-chars-long!";
const SESSION_SECRET = "test-auth-jwt-secret-min-32-characters-long";

vi.mock("@/lib/env", () => ({
  env: {
    CRAFT_LAUNCH_SECRET: "test-craft-launch-secret-min-32-chars-long!",
    AUTH_JWT_SECRET: "test-auth-jwt-secret-min-32-characters-long",
    NEXT_PUBLIC_APP_URL: "https://uamsatech.test",
    LECTURESUITE_SSO_URL: "https://api.lecturesuite.test/api/auth/sso",
    SCHOLARSUITE_SSO_URL: "https://api.scholarsuite.test/api/auth/sso",
    RESEARCHSUITE_SSO_URL: "https://api.researchsuite.test/api/auth/sso",
  },
}));

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const findUnique = vi.fn();

// In-memory subscriptions + memberships. findMany applies the same filter the
// resolver's query expresses: product slug IN (...) AND (own row OR a row of an
// organization the user belongs to).
type SubRow = {
  id: string;
  slug: string;
  userId: string | null;
  organizationId: string | null;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};
let subs: SubRow[] = [];
let memberships: { userId: string; organizationId: string }[] = [];
const findMany = vi.fn(
  async (args: {
    where: {
      product: { slug: { in: string[] } };
      OR: [{ userId: string }, unknown];
    };
  }) => {
    const slugs = args.where.product.slug.in;
    const userId = args.where.OR[0].userId;
    const orgs = new Set(
      memberships
        .filter((m) => m.userId === userId)
        .map((m) => m.organizationId)
    );
    return subs
      .filter((s) => slugs.includes(s.slug))
      .filter(
        (s) =>
          s.userId === userId ||
          (s.organizationId !== null && orgs.has(s.organizationId))
      )
      .map((s) => ({
        id: s.id,
        userId: s.userId,
        organizationId: s.organizationId,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      }));
  }
);
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: (a: unknown) => findUnique(a) },
    subscription: { findMany: (a: never) => findMany(a) },
  },
}));

const logActivity = vi.fn();
vi.mock("@/lib/portal/audit", () => ({
  logActivity: (...a: unknown[]) => logActivity(...a),
}));

const { signLaunchToken, LAUNCH_TOKEN_TTL_SECONDS } =
  await import("@/lib/auth/launch-jwt");
const { GET } = await import("@/app/api/portal/launch/[product]/route");
const { evaluateSubscription, resolveProductEntitlement } =
  await import("@/lib/portal/entitlement");

const DAY = 864e5;
const future = () => new Date(Date.now() + 30 * DAY);
const past = () => new Date(Date.now() - DAY);
function sub(overrides: Partial<SubRow>): SubRow {
  return {
    id: "sub-1",
    slug: "scholarcraft",
    userId: "portal-user-1",
    organizationId: null,
    status: "ACTIVE",
    currentPeriodEnd: future(),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

const key = (s: string) => new TextEncoder().encode(s);

function call(product: string) {
  return GET(
    new Request(`https://uamsatech.test/api/portal/launch/${product}`),
    {
      params: Promise.resolve({ product }),
    }
  );
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findMany.mockClear();
  logActivity.mockReset();
  logActivity.mockResolvedValue(undefined);
  getSession.mockResolvedValue({ sub: "portal-user-1" });
  findUnique.mockResolvedValue({ email: "person@uamsatech.com" });
  // Default: entitled to BOTH products individually, so the routing tests
  // below exercise the happy path. Entitlement tests override this.
  subs = [
    sub({ id: "sub-scholar", slug: "scholarcraft" }),
    sub({ id: "sub-lecture", slug: "lecturercraft" }),
    sub({ id: "sub-research", slug: "researchsuite" }),
  ];
  memberships = [];
});

describe("signLaunchToken", () => {
  it("produces an HS256 token with the full product-launch claim contract", async () => {
    const token = await signLaunchToken(
      "portal-user-1",
      "person@uamsatech.com",
      "scholarsuite"
    );
    expect(decodeProtectedHeader(token).alg).toBe("HS256");
    const { payload } = await jwtVerify(token, key(LAUNCH_SECRET), {
      algorithms: ["HS256"],
      issuer: "uamsatech",
      audience: "scholarsuite",
    });
    expect(payload).toMatchObject({
      sub: "portal-user-1",
      email: "person@uamsatech.com",
      type: "product_launch",
      target: "scholarsuite",
      iss: "uamsatech",
      aud: "scholarsuite",
    });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.exp! - payload.iat!).toBe(LAUNCH_TOKEN_TTL_SECONDS);
    expect(LAUNCH_TOKEN_TTL_SECONDS).toBe(300);
  });

  it("issues a unique jti per token", async () => {
    const jtis = new Set<unknown>();
    for (let i = 0; i < 20; i++) {
      const t = await signLaunchToken("u", "e@x.com", "lecturesuite");
      jtis.add((await jwtVerify(t, key(LAUNCH_SECRET))).payload.jti);
    }
    expect(jtis.size).toBe(20);
  });

  it("is not verifiable with the portal session secret (secret separation)", async () => {
    const token = await signLaunchToken("u", "e@x.com", "lecturesuite");
    await expect(jwtVerify(token, key(SESSION_SECRET))).rejects.toThrow();
  });

  it("a lecturesuite token fails scholarsuite audience verification", async () => {
    const token = await signLaunchToken("u", "e@x.com", "lecturesuite");
    await expect(
      jwtVerify(token, key(LAUNCH_SECRET), {
        issuer: "uamsatech",
        audience: "scholarsuite",
      })
    ).rejects.toThrow();
  });
});

describe("GET /api/portal/launch/[product]", () => {
  it("redirects an unauthenticated user to /login without signing a token", async () => {
    getSession.mockResolvedValue(null);
    const res = await call("scholarsuite");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://uamsatech.test/login");
    expect(loc.searchParams.has("token")).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("redirects to /login when the session user no longer exists", async () => {
    findUnique.mockResolvedValue(null);
    const res = await call("scholarsuite");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.headers.get("location")).not.toContain("token=");
  });

  it.each([
    [
      "scholarcraft",
      "https://api.scholarsuite.test/api/auth/sso",
      "scholarsuite",
    ],
    [
      "scholarsuite",
      "https://api.scholarsuite.test/api/auth/sso",
      "scholarsuite",
    ],
    [
      "lecturercraft",
      "https://api.lecturesuite.test/api/auth/sso",
      "lecturesuite",
    ],
    [
      "lecturesuite",
      "https://api.lecturesuite.test/api/auth/sso",
      "lecturesuite",
    ],
    [
      "researchsuite",
      "https://api.researchsuite.test/api/auth/sso",
      "researchsuite",
    ],
  ])(
    "slug %s → only its approved SSO endpoint, with a %s-bound token",
    async (slug, endpoint, target) => {
      const res = await call(slug);
      expect(res.status).toBe(307);
      const loc = new URL(res.headers.get("location")!);
      expect(loc.origin + loc.pathname).toBe(endpoint);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      const { payload } = await jwtVerify(
        loc.searchParams.get("token")!,
        key(LAUNCH_SECRET),
        {
          issuer: "uamsatech",
          audience: target,
        }
      );
      expect(payload.target).toBe(target);
      expect(payload.sub).toBe("portal-user-1");
    }
  );

  it.each([
    "thesiscraft",
    "uamsa",
    "evil.com",
    "https:%2F%2Fevil.com",
    "constructor",
    "__proto__",
    "toString",
    "",
  ])(
    "rejects unknown/invalid product slug %p with 400 and no token",
    async (slug) => {
      const res = await call(slug);
      expect(res.status).toBe(400);
      expect(res.headers.get("location")).toBeNull();
      expect(await res.text()).not.toMatch(/token|secret/i);
    }
  );

  it("ignores attacker-supplied redirect parameters", async () => {
    const res = await GET(
      new Request(
        "https://uamsatech.test/api/portal/launch/scholarsuite?redirect=https://evil.com&next=//evil.com"
      ),
      { params: Promise.resolve({ product: "scholarsuite" }) }
    );
    expect(new URL(res.headers.get("location")!).host).toBe(
      "api.scholarsuite.test"
    );
  });
});

describe("evaluateSubscription (entitlement policy)", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const later = new Date("2026-12-04T12:00:00Z");
  const earlier = new Date("2026-10-04T12:00:00Z");
  const ev = (s: Partial<Parameters<typeof evaluateSubscription>[0]>) =>
    evaluateSubscription(
      {
        status: "ACTIVE",
        currentPeriodEnd: later,
        cancelAtPeriodEnd: false,
        ...s,
      },
      now
    );

  it("grants ACTIVE with a paid-through date in the future", () => {
    expect(ev({})).toEqual({ ok: true });
  });
  it("grants ACTIVE scheduled to cancel at period end while the period is still paid", () => {
    expect(ev({ cancelAtPeriodEnd: true })).toEqual({ ok: true });
  });
  it("denies ACTIVE scheduled to cancel once the period has ended", () => {
    expect(ev({ cancelAtPeriodEnd: true, currentPeriodEnd: earlier })).toEqual({
      ok: false,
      reason: "expired",
    });
  });
  it("denies ACTIVE whose paid-through date has passed", () => {
    expect(ev({ currentPeriodEnd: earlier })).toEqual({
      ok: false,
      reason: "expired",
    });
  });
  it("denies ACTIVE exactly at the paid-through instant", () => {
    expect(ev({ currentPeriodEnd: now })).toEqual({
      ok: false,
      reason: "expired",
    });
  });
  it("denies ACTIVE with no paid-through date (a row alone is not proof)", () => {
    expect(ev({ currentPeriodEnd: null })).toEqual({
      ok: false,
      reason: "period_end_unknown",
    });
  });
  it("denies TRIALING: no explicitly authorised trial can be established", () => {
    expect(ev({ status: "TRIALING" })).toEqual({
      ok: false,
      reason: "trial_not_authorized",
    });
  });
  it("denies PAST_DUE (no grace-period policy), even inside the period", () => {
    expect(ev({ status: "PAST_DUE" })).toEqual({
      ok: false,
      reason: "past_due",
    });
  });
  it("denies CANCELED, even with a future period end", () => {
    expect(ev({ status: "CANCELED" })).toEqual({
      ok: false,
      reason: "canceled",
    });
  });
  it("denies any unknown status", () => {
    expect(ev({ status: "PAUSED" as never })).toEqual({
      ok: false,
      reason: "status_not_entitled",
    });
  });
});

describe("resolveProductEntitlement", () => {
  it("grants from an individual subscription", async () => {
    subs = [sub({ id: "ind" })];
    expect(
      await resolveProductEntitlement("portal-user-1", "scholarsuite")
    ).toEqual({
      granted: true,
      source: "individual",
      subscriptionId: "ind",
      organizationId: null,
    });
  });

  it("is product-specific: a ScholarSuite subscription does not grant LectureSuite", async () => {
    subs = [sub({ slug: "scholarcraft" })];
    expect(
      await resolveProductEntitlement("portal-user-1", "lecturesuite")
    ).toEqual({
      granted: false,
      reason: "no_subscription",
    });
  });

  it("matches the canonical catalog slug as well as the legacy one", async () => {
    subs = [sub({ id: "canon", slug: "lecturesuite" })];
    expect(
      (await resolveProductEntitlement("portal-user-1", "lecturesuite")).granted
    ).toBe(true);
  });

  it("grants from an institutional (organization) licence the user is a member of", async () => {
    subs = [sub({ id: "org-sub", userId: null, organizationId: "org-1" })];
    memberships = [{ userId: "portal-user-1", organizationId: "org-1" }];
    expect(
      await resolveProductEntitlement("portal-user-1", "scholarsuite")
    ).toEqual({
      granted: true,
      source: "institution",
      subscriptionId: "org-sub",
      organizationId: "org-1",
    });
  });

  it("denies an organization licence to a non-member", async () => {
    subs = [sub({ userId: null, organizationId: "org-1" })];
    memberships = [{ userId: "someone-else", organizationId: "org-1" }];
    expect(
      (await resolveProductEntitlement("portal-user-1", "scholarsuite")).granted
    ).toBe(false);
  });

  it("denies an expired institutional licence", async () => {
    subs = [
      sub({ userId: null, organizationId: "org-1", currentPeriodEnd: past() }),
    ];
    memberships = [{ userId: "portal-user-1", organizationId: "org-1" }];
    expect(
      await resolveProductEntitlement("portal-user-1", "scholarsuite")
    ).toEqual({
      granted: false,
      reason: "expired",
    });
  });

  it("falls back to a valid institutional licence when the individual one is lapsed", async () => {
    subs = [
      sub({ id: "ind", status: "PAST_DUE" }),
      sub({ id: "org-sub", userId: null, organizationId: "org-1" }),
    ];
    memberships = [{ userId: "portal-user-1", organizationId: "org-1" }];
    const d = await resolveProductEntitlement("portal-user-1", "scholarsuite");
    expect(d).toMatchObject({
      granted: true,
      source: "institution",
      subscriptionId: "org-sub",
    });
  });

  it("reports the individual denial reason first when nothing grants", async () => {
    subs = [
      sub({ status: "TRIALING" }),
      sub({
        id: "org",
        userId: null,
        organizationId: "org-1",
        status: "CANCELED",
      }),
    ];
    memberships = [{ userId: "portal-user-1", organizationId: "org-1" }];
    expect(
      await resolveProductEntitlement("portal-user-1", "scholarsuite")
    ).toEqual({
      granted: false,
      reason: "trial_not_authorized",
    });
  });
});

describe("GET /api/portal/launch/[product] — entitlement enforcement", () => {
  it("returns 403, signs no token and audits the denial when there is no subscription", async () => {
    subs = [];
    const res = await call("scholarsuite");
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.json()).toEqual({
      error: "You do not have active access to this product.",
    });
    expect(logActivity).toHaveBeenCalledWith(
      "portal-user-1",
      "product.launch_denied",
      {
        product: "scholarsuite",
        slug: "scholarsuite",
        reason: "no_subscription",
      }
    );
  });

  it.each([
    ["PAST_DUE", future(), "past_due"],
    ["CANCELED", future(), "canceled"],
    ["TRIALING", future(), "trial_not_authorized"],
    ["ACTIVE", past(), "expired"],
    ["ACTIVE", null, "period_end_unknown"],
  ] as const)(
    "denies a %s subscription (period end %s) with 403 / %s",
    async (status, end, reason) => {
      subs = [sub({ status, currentPeriodEnd: end })];
      const res = await call("scholarcraft");
      expect(res.status).toBe(403);
      expect(res.headers.get("location")).toBeNull();
      expect(logActivity.mock.calls[0][2]).toMatchObject({ reason });
    }
  );

  it("a LectureSuite subscription cannot launch ScholarSuite", async () => {
    subs = [sub({ slug: "lecturercraft" })];
    expect((await call("scholarsuite")).status).toBe(403);
    expect((await call("lecturesuite")).status).toBe(307);
  });

  it("audits a successful launch with source and subscription, never the token", async () => {
    subs = [sub({ id: "org-sub", userId: null, organizationId: "org-1" })];
    memberships = [{ userId: "portal-user-1", organizationId: "org-1" }];
    const res = await call("scholarsuite");
    expect(res.status).toBe(307);
    const token = new URL(res.headers.get("location")!).searchParams.get(
      "token"
    )!;
    expect(logActivity).toHaveBeenCalledWith(
      "portal-user-1",
      "product.launch_granted",
      {
        product: "scholarsuite",
        slug: "scholarsuite",
        source: "institution",
        subscriptionId: "org-sub",
      },
      "org-1"
    );
    expect(JSON.stringify(logActivity.mock.calls)).not.toContain(token);
  });

  it("refuses to launch (503, no token) when the grant cannot be audited", async () => {
    logActivity.mockRejectedValue(new Error("db down"));
    const res = await call("scholarsuite");
    expect(res.status).toBe(503);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still returns 403 when auditing a denial fails", async () => {
    subs = [];
    logActivity.mockRejectedValue(new Error("db down"));
    expect((await call("scholarsuite")).status).toBe(403);
  });

  it("checks entitlement only after authentication", async () => {
    getSession.mockResolvedValue(null);
    await call("scholarsuite");
    expect(findMany).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("fails closed when the entitlement lookup itself errors: no token, no grant audit", async () => {
    findMany.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(call("scholarsuite")).rejects.toThrow(/db unavailable/);
    expect(logActivity).not.toHaveBeenCalledWith(
      "portal-user-1",
      "product.launch_granted",
      expect.anything(),
      expect.anything()
    );
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("unknown slugs are rejected before any entitlement lookup", async () => {
    expect((await call("thesiscraft")).status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("portal env schema", () => {
  it("rejects CRAFT_LAUNCH_SECRET equal to AUTH_JWT_SECRET", async () => {
    const schema = await importSchemaWithCleanEnv();
    const base = {
      DATABASE_URL: "postgresql://x",
      AUTH_JWT_SECRET: SESSION_SECRET,
      CRAFT_LAUNCH_SECRET: LAUNCH_SECRET,
    };
    expect(schema.safeParse(base).success).toBe(true);
    const same = schema.safeParse({
      ...base,
      CRAFT_LAUNCH_SECRET: SESSION_SECRET,
    });
    expect(same.success).toBe(false);
    expect(JSON.stringify(same.error?.issues)).toContain(
      "must differ from AUTH_JWT_SECRET"
    );
    expect(
      schema.safeParse({ ...base, CRAFT_LAUNCH_SECRET: undefined }).success
    ).toBe(false);
    expect(
      schema.safeParse({ ...base, CRAFT_LAUNCH_SECRET: "short" }).success
    ).toBe(false);
  });
});

/**
 * lib/env.ts parses process.env at import time, and tests/setup.ts loads the
 * developer's local .env — so import the real module under a known-good
 * environment to get at the exported schema.
 */
async function importSchemaWithCleanEnv() {
  const saved = { ...process.env };
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://x",
    AUTH_JWT_SECRET: SESSION_SECRET,
    CRAFT_LAUNCH_SECRET: LAUNCH_SECRET,
  });
  vi.resetModules();
  try {
    return (await vi.importActual<typeof import("@/lib/env")>("@/lib/env"))
      .envSchema;
  } finally {
    process.env = saved;
  }
}
