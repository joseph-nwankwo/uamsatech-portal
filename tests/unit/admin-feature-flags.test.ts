import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// S2 — PATCH /api/admin/feature-flags/[id]: admin-gated, audited with the
// old and new value in the same transaction as the update.

type Flag = { id: string; key: string; isEnabled: boolean };

let admin: { id: string } | null = null;
let flags: Map<string, Flag>;
let auditRows: Array<Record<string, unknown>>;
let rateLimitAllowed = true;
const dbTouched = vi.fn();

vi.mock("@/lib/admin/auth", () => ({
  requireAdminApi: async () =>
    admin
      ? { ok: true, user: admin }
      : {
          ok: false,
          response: NextResponse.json({ error: "Not found" }, { status: 404 }),
        },
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: rateLimitAllowed }),
}));
vi.mock("@/lib/db", () => {
  const tx = {
    featureFlag: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        dbTouched();
        const f = flags.get(where.id);
        return f ? { ...f } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { isEnabled: boolean };
      }) => {
        dbTouched();
        const f = { ...flags.get(where.id)!, ...data };
        flags.set(where.id, f);
        return { ...f };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        dbTouched();
        auditRows.push(data);
        return data;
      },
    },
  };
  return {
    db: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});

const { PATCH } = await import("@/app/api/admin/feature-flags/[id]/route");

function call(id: string, body: unknown) {
  const req = new Request(`http://test/api/admin/feature-flags/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  admin = null;
  rateLimitAllowed = true;
  flags = new Map([
    ["f1", { id: "f1", key: "billing_paystack_enabled", isEnabled: false }],
  ]);
  auditRows = [];
  dbTouched.mockClear();
});

describe("PATCH /api/admin/feature-flags/[id]", () => {
  it("404s a non-admin (including any org OWNER) without touching the DB", async () => {
    const res = await call("f1", { isEnabled: true });
    expect(res.status).toBe(404);
    expect(dbTouched).not.toHaveBeenCalled();
    expect(flags.get("f1")!.isEnabled).toBe(false);
    expect(auditRows).toHaveLength(0);
  });

  it("lets an admin toggle a flag and records actor, key, old and new value", async () => {
    admin = { id: "admin-1" };
    const res = await call("f1", { isEnabled: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ flag: { id: "f1", isEnabled: true } });
    expect(flags.get("f1")!.isEnabled).toBe(true);
    expect(auditRows).toEqual([
      {
        userId: "admin-1",
        action: "feature_flag.updated",
        metadata: {
          key: "billing_paystack_enabled",
          oldValue: false,
          newValue: true,
        },
        organizationId: undefined,
      },
    ]);
  });

  it("writes nothing when the value doesn't change", async () => {
    admin = { id: "admin-1" };
    const res = await call("f1", { isEnabled: false });
    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(0);
  });

  it("404s an unknown flag id instead of 500ing", async () => {
    admin = { id: "admin-1" };
    const res = await call("missing", { isEnabled: true });
    expect(res.status).toBe(404);
    expect(auditRows).toHaveLength(0);
  });

  it("400s an invalid body", async () => {
    admin = { id: "admin-1" };
    const res = await call("f1", { isEnabled: "yes" });
    expect(res.status).toBe(400);
    expect(flags.get("f1")!.isEnabled).toBe(false);
  });

  it("429s when the admin is rate limited", async () => {
    admin = { id: "admin-1" };
    rateLimitAllowed = false;
    const res = await call("f1", { isEnabled: true });
    expect(res.status).toBe(429);
    expect(flags.get("f1")!.isEnabled).toBe(false);
  });
});
