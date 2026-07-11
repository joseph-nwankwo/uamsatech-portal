import { describe, it, expect } from "vitest";
import { BASE_URL } from "./helpers";

// Every one of these must reject an anonymous caller. A regression here —
// even on one route — is a real, direct data-exposure or privilege bug, not
// a style nit, which is why these run as their own dedicated suite rather
// than being folded into a single "smoke test".
describe("unauthenticated access is rejected", () => {
  it("redirects anonymous requests away from /portal (middleware)", async () => {
    const res = await fetch(`${BASE_URL}/portal/dashboard`, {
      redirect: "manual",
    });
    expect([307, 302]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects anonymous requests away from /admin (middleware)", async () => {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    expect([307, 302]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("rejects an unauthenticated organization update", async () => {
    const res = await fetch(`${BASE_URL}/api/portal/organization`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hacked" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated profile update", async () => {
    const res = await fetch(`${BASE_URL}/api/portal/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hacked" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated API key creation", async () => {
    const res = await fetch(`${BASE_URL}/api/portal/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "attacker key" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated avatar upload attempt", async () => {
    const res = await fetch(`${BASE_URL}/api/portal/profile/avatar`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated feature-vote", async () => {
    const res = await fetch(
      `${BASE_URL}/api/feature-requests/nonexistent-id/vote`,
      { method: "POST" }
    );
    expect(res.status).toBe(401);
  });
});
