import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { catalogSlugFor } from "@/lib/portal/entitlement";
import { products } from "@/lib/site-config";

// Databases seeded before the rename hold "scholarcraft"/"lecturercraft".
// The portal pages compare subscriptions against the catalogue, so a
// pre-rename slug must map to the catalogue slug or a subscribed user is
// shown as "Not subscribed".
describe("catalogSlugFor", () => {
  it.each([
    ["scholarcraft", "scholarsuite"],
    ["scholarsuite", "scholarsuite"],
    ["lecturercraft", "lecturesuite"],
    ["lecturesuite", "lecturesuite"],
    ["researchsuite", "researchsuite"],
  ])("maps %s to %s", (dbSlug, catalogSlug) => {
    expect(catalogSlugFor(dbSlug)).toBe(catalogSlug);
  });

  it("passes unknown slugs through unchanged", () => {
    expect(catalogSlugFor("records")).toBe("records");
  });

  it("only ever yields slugs that exist in the catalogue for known products", () => {
    const catalogue = new Set(products.map((p) => p.slug));
    for (const s of ["scholarcraft", "lecturercraft", "researchsuite"]) {
      expect(catalogue.has(catalogSlugFor(s))).toBe(true);
    }
  });
});
