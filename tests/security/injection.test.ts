import { describe, it, expect } from "vitest";
import { BASE_URL } from "./helpers";

describe("malformed / injection-style input is rejected safely", () => {
  it("rejects a SQL-injection-style email at the validation layer, not the DB", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "' OR 1=1--", password: "x" }),
    });
    // Zod's email format check rejects this before it ever reaches Prisma —
    // a 400, not a 500 (which would suggest it reached the DB layer
    // unhandled) and not a 200 (which would suggest an actual bypass).
    expect(res.status).toBe(400);
  });

  it("rejects an oversized name on signup instead of storing it unbounded", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A".repeat(10_000),
        email: `overflow-${Date.now()}@example.com`,
        password: "TestPass123!",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a password over bcrypt's 72-byte effective limit", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Overlong Password Test",
        email: `overflow-pw-${Date.now()}@example.com`,
        password: "P4ss!" + "a".repeat(100),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-object JSON body instead of crashing", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("just a string, not an object"),
    });
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON instead of crashing", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    });
    expect(res.status).toBe(400);
  });
});
