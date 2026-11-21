import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { signAccessToken } from "@/lib/auth/jwt";
import { BASE_URL, createDbTestUser, type TestUser } from "./helpers";

// S2 regression: global feature flags are managed only by platform admins.
// An org OWNER who isn't a platform admin gets the admin gate's 404, the old
// portal page/route are gone, and an admin toggle writes an audit row.
//
// Uses a throwaway flag so the real billing flags (which checkout reads for
// every customer) are never touched. No HTTP signups (see global-setup.ts).
//
// The admin case reuses TEST_ADMIN_EMAIL from email-normalization.test.ts;
// security files run sequentially (vitest.security.config.ts), so the two
// never hold the address at the same time.

const TEST_ADMIN_EMAIL = "security-admin@example.com";
const allowlisted = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(normalizeEmail)
  .includes(TEST_ADMIN_EMAIL);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let flagId: string;
let flagKey: string;
const userIds: string[] = [];
let orgId: string | undefined;

function request(token: string, method: string, path: string, body?: unknown) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Cookie: `access_token=${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

beforeAll(async () => {
  flagKey = `test_s2_flag_${suffix}`;
  const flag = await db.featureFlag.create({
    data: { key: flagKey, name: `S2 test flag ${suffix}`, isEnabled: false },
  });
  flagId = flag.id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({
    where: {
      action: "feature_flag.updated",
      metadata: { path: ["key"], equals: flagKey },
    },
  });
  await db.featureFlag.deleteMany({ where: { id: flagId } });
  if (orgId) await db.organization.deleteMany({ where: { id: orgId } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("feature flags: org OWNER who is not a platform admin (S2)", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createDbTestUser("s2-owner");
    userIds.push(owner.userId);
    await db.user.update({
      where: { id: owner.userId },
      data: { emailVerified: new Date() },
    });
    const org = await db.organization.create({
      data: {
        name: "S2 Test Org",
        slug: `s2-test-${suffix}`,
        memberships: { create: { userId: owner.userId, role: "OWNER" } },
      },
    });
    orgId = org.id;
    // A real OWNER session: the token carries the org and the OWNER role,
    // exactly what the old portal route trusted.
    owner.accessToken = await signAccessToken({
      sub: owner.userId,
      orgId: org.id,
      role: "OWNER",
    });
  });

  it("gets 404 on the admin flag write endpoint and the flag is unchanged", async () => {
    const res = await request(
      owner.accessToken,
      "PATCH",
      `/api/admin/feature-flags/${flagId}`,
      { isEnabled: true }
    );
    expect(res.status).toBe(404);
    const row = await db.featureFlag.findUnique({ where: { id: flagId } });
    expect(row?.isEnabled).toBe(false);
  });

  it("cannot load the admin management page", async () => {
    const res = await request(owner.accessToken, "GET", "/admin/feature-flags");
    expect(res.status).toBe(404);
  });

  it("finds the old portal write route gone", async () => {
    const res = await request(
      owner.accessToken,
      "PATCH",
      `/api/portal/feature-flags/${flagId}`,
      { isEnabled: true }
    );
    expect(res.status).toBe(404);
    const row = await db.featureFlag.findUnique({ where: { id: flagId } });
    expect(row?.isEnabled).toBe(false);
  });

  it("finds the old portal page gone", async () => {
    const res = await request(
      owner.accessToken,
      "GET",
      "/portal/feature-flags"
    );
    expect(res.status).toBe(404);
  });

  it("writes no audit row for the denied attempts", async () => {
    const count = await db.auditLog.count({
      where: {
        action: "feature_flag.updated",
        metadata: { path: ["key"], equals: flagKey },
      },
    });
    expect(count).toBe(0);
  });
});

describe.skipIf(!allowlisted)(
  "feature flags: verified, allowlisted platform admin (S2)",
  () => {
    let adminToken: string;
    let adminId: string;

    beforeAll(async () => {
      // A leftover from an interrupted earlier run would collide.
      await db.user.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
      const user = await db.user.create({
        data: {
          name: "Security Admin",
          email: TEST_ADMIN_EMAIL,
          passwordHash: "x",
          emailVerified: new Date(),
        },
      });
      adminId = user.id;
      userIds.push(adminId);
      adminToken = await signAccessToken({ sub: adminId });
    });

    it("loads /admin/feature-flags", async () => {
      const res = await request(adminToken, "GET", "/admin/feature-flags");
      expect(res.status).toBe(200);
    });

    it("toggles a flag and an audit row records actor, key, old and new value", async () => {
      const res = await request(
        adminToken,
        "PATCH",
        `/api/admin/feature-flags/${flagId}`,
        { isEnabled: true }
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        flag: { id: flagId, isEnabled: true },
      });

      const row = await db.featureFlag.findUnique({ where: { id: flagId } });
      expect(row?.isEnabled).toBe(true);

      const audits = await db.auditLog.findMany({
        where: {
          action: "feature_flag.updated",
          metadata: { path: ["key"], equals: flagKey },
        },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0].userId).toBe(adminId);
      expect(audits[0].organizationId).toBeNull();
      expect(audits[0].metadata).toEqual({
        key: flagKey,
        oldValue: false,
        newValue: true,
      });
    });
  }
);
