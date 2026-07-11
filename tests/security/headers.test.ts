import { describe, it, expect } from "vitest";
import { BASE_URL } from "./helpers";

describe("security headers are present on real responses", () => {
  it("sends the full header set on the homepage", async () => {
    const res = await fetch(BASE_URL);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(res.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'"
    );
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("never leaks the X-Powered-By framework header", async () => {
    const res = await fetch(BASE_URL);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("sends the same headers on an API route, not just pages", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });
});
