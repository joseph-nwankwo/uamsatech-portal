import { describe, it, expect, inject } from "vitest";
import { BASE_URL, authHeaders } from "./helpers";

// change-password is limited to 5 attempts / 15 minutes
// (app/api/portal/change-password/route.ts) — deliberately tight, since
// each attempt forces a real bcrypt comparison (cost 12, intentionally
// slow) and repeated wrong-password guesses against your own account.
//
// This deliberately exhausts the shared test user's change-password limit —
// it must be the only test file that calls this endpoint, or it'll collide
// with another test's assumptions about that limit still being fresh.
describe("rate limiting is actually enforced (not just present in the code)", () => {
  const user = inject("sharedUser");

  it("allows exactly the configured limit, then returns 429", async () => {
    const attempt = () =>
      fetch(`${BASE_URL}/api/portal/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(user),
        },
        body: JSON.stringify({
          currentPassword: "deliberately-wrong",
          newPassword: "WouldBeNewPass123!",
        }),
      });

    const results: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await attempt();
      results.push(res.status);
    }

    // First 5 fail on the wrong-password check (401); the limiter blocks
    // everything after that (429) — proving the block, not just a
    // coincidental run of failures.
    expect(results.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(results.slice(5)).toEqual([429, 429]);
  });
});
