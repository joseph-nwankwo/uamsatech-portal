import { describe, it, expect } from "vitest";
import { displayName } from "@/features/blog/display-name";

// Regression test for the real privacy bug caught and fixed this session:
// blog comments used to fall back to the commenter's raw email address on a
// fully public page when no name was set. This locks that fix in place.
describe("displayName — public comment fallback", () => {
  it("shows the real name when one is set", () => {
    expect(displayName("Ada Lovelace")).toBe("Ada Lovelace");
  });

  it("falls back to Anonymous when name is null", () => {
    expect(displayName(null)).toBe("Anonymous");
  });

  it("falls back to Anonymous when name is an empty string", () => {
    expect(displayName("")).toBe("Anonymous");
  });

  it("falls back to Anonymous when name is only whitespace", () => {
    expect(displayName("   ")).toBe("Anonymous");
  });

  it("never returns anything containing an @ (would suggest an email leaked through)", () => {
    expect(displayName(null)).not.toContain("@");
    expect(displayName("")).not.toContain("@");
  });
});
