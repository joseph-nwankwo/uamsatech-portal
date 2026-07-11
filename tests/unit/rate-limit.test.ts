import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/auth/rate-limit";

// REDIS_URL is unset in this test environment (no Redis available here —
// see lib/redis.ts), so these exercise the real in-memory fallback path,
// the only backend actually reachable in this sandbox.

describe("checkRateLimit (in-memory backend)", () => {
  it("allows requests under the limit", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const result = await checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("blocks the request that exceeds the limit", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkRateLimit(key, 3, 60_000));
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  });

  it("reports a positive retryAfterMs once blocked", async () => {
    const key = `test:${crypto.randomUUID()}`;
    await checkRateLimit(key, 1, 60_000);
    const blocked = await checkRateLimit(key, 1, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("tracks separate keys independently", async () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;
    await checkRateLimit(keyA, 1, 60_000);
    const aBlocked = await checkRateLimit(keyA, 1, 60_000);
    const bAllowed = await checkRateLimit(keyB, 1, 60_000);
    expect(aBlocked.allowed).toBe(false);
    expect(bAllowed.allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const windowMs = 50;
    await checkRateLimit(key, 1, windowMs);
    const blocked = await checkRateLimit(key, 1, windowMs);
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, windowMs + 20));

    const afterReset = await checkRateLimit(key, 1, windowMs);
    expect(afterReset.allowed).toBe(true);
  });
});
