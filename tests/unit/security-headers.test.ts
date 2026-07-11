import { describe, it, expect } from "vitest";
import { buildCsp, buildSecurityHeaders } from "@/lib/security-headers";

// Regression test for the real bug caught this session: the CSP shipped
// without 'unsafe-eval' in dev mode, which silently blocked React hydration
// under `next dev` (Next's Fast Refresh needs eval()) — every client
// component looked "blank" with no console error. This locks the dev/prod
// split in place so it can't regress silently again.
describe("buildCsp", () => {
  it("includes 'unsafe-eval' in development (Next Fast Refresh needs it)", () => {
    expect(buildCsp(true)).toContain("'unsafe-eval'");
  });

  it("never includes 'unsafe-eval' in production", () => {
    expect(buildCsp(false)).not.toContain("'unsafe-eval'");
  });

  it("always restricts framing to prevent clickjacking", () => {
    expect(buildCsp(false)).toContain("frame-ancestors 'none'");
  });

  it("always scopes default-src to self", () => {
    expect(buildCsp(false)).toContain("default-src 'self'");
  });
});

describe("buildSecurityHeaders", () => {
  it("includes every required security header", () => {
    const headers = buildSecurityHeaders(false);
    const keys = headers.map((h) => h.key);
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("Content-Security-Policy");
  });

  it("sets X-Frame-Options to DENY, not just SAMEORIGIN", () => {
    const headers = buildSecurityHeaders(false);
    const xfo = headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo?.value).toBe("DENY");
  });

  it("sets a long-lived, subdomain-inclusive HSTS policy", () => {
    const headers = buildSecurityHeaders(false);
    const hsts = headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toMatch(/max-age=\d+/);
    expect(hsts?.value).toContain("includeSubDomains");
  });
});
