import { describe, it, expect, inject } from "vitest";
import { BASE_URL, authHeaders } from "./helpers";

describe("/admin gate", () => {
  const nonAdmin = inject("sharedUser");

  it("404s a signed-in, non-admin account — not 403", async () => {
    const res = await fetch(`${BASE_URL}/admin`, {
      headers: authHeaders(nonAdmin),
      redirect: "manual",
    });
    // Deliberately 404, not 403 — an ordinary customer shouldn't be able to
    // confirm the route even exists. A regression to 403 here is a real
    // information-disclosure downgrade, not a cosmetic difference.
    expect(res.status).toBe(404);
  });

  it("404s every admin sub-route the same way", async () => {
    const routes = [
      "/admin/revenue",
      "/admin/customers",
      "/admin/marketing",
      "/admin/product",
      "/admin/conversion",
    ];
    for (const route of routes) {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: authHeaders(nonAdmin),
        redirect: "manual",
      });
      expect(res.status).toBe(404);
    }
  });
});
