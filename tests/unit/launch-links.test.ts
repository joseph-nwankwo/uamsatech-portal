import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ENTITLEMENT_LAUNCH_SLUGS, productLaunchHref, requiresEntitlementLaunch } from "@/lib/portal/launch-links";
import { products } from "@/lib/site-config";

// AS-P0-SECURITY-006A — authenticated launch controls must use the
// entitlement-checked launch route for every Academic Suite product.

const root = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("productLaunchHref", () => {
  it.each(["lecturercraft", "lecturesuite", "scholarcraft", "scholarsuite"])(
    "%s launches through /api/portal/launch (never a direct product URL)",
    (slug) => {
      const href = productLaunchHref({ slug, subdomain: `${slug}.uamsatech.com` });
      expect(href).toBe(`/api/portal/launch/${slug}`);
      expect(href).not.toContain("uamsatech.com");
    }
  );

  it("is a same-origin relative path, so it cannot be turned into an open redirect", () => {
    for (const slug of ENTITLEMENT_LAUNCH_SLUGS) {
      expect(productLaunchHref({ slug, subdomain: "evil.example" }).startsWith("/api/portal/launch/")).toBe(true);
    }
  });

  it("every Academic Suite product in the catalog is covered", () => {
    const academic = products.filter((p) => /lecture|scholar/i.test(p.slug));
    expect(academic.length).toBeGreaterThan(0);
    for (const p of academic) expect(requiresEntitlementLaunch(p.slug)).toBe(true);
  });

  it("products outside central entitlement (UAMSA ERP) keep their own direct link", () => {
    expect(productLaunchHref({ slug: "uamsa", subdomain: "uamsa.uamsatech.com" })).toBe("https://uamsa.uamsatech.com");
  });

  it("the launch-route allowlist accepts exactly these slugs (kept in step)", () => {
    const route = read("app/api/portal/launch/[product]/route.ts");
    const keys = [...route.matchAll(/\["([a-z]+)",\s*(LECTURESUITE|SCHOLARSUITE)\]/g)].map((m) => m[1]).sort();
    expect(keys).toEqual([...ENTITLEMENT_LAUNCH_SLUGS].sort());
  });
});

describe("no authenticated launch control bypasses the launch route", () => {
  it.each(["app/portal/dashboard/page.tsx", "app/portal/products/page.tsx"])("%s uses productLaunchHref and no raw subdomain link", (file) => {
    const src = read(file);
    expect(src).toContain("productLaunchHref(product)");
    expect(src).not.toMatch(/href=\{`https:\/\/\$\{product\.subdomain\}`\}/);
  });
});
