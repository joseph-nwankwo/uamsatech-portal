import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/portal/permissions";

describe("hasPermission — the security boundary every portal mutation route checks", () => {
  it("grants OWNER every permission", () => {
    const permissions = [
      "organization.manage",
      "members.invite",
      "members.remove",
      "members.changeRole",
      "billing.manage",
      "featureFlags.manage",
      "activity.viewOrganization",
    ] as const;
    for (const permission of permissions) {
      expect(hasPermission("OWNER", permission)).toBe(true);
    }
  });

  it("denies ADMIN the owner-only permissions", () => {
    expect(hasPermission("ADMIN", "members.changeRole")).toBe(false);
    expect(hasPermission("ADMIN", "billing.manage")).toBe(false);
    expect(hasPermission("ADMIN", "featureFlags.manage")).toBe(false);
  });

  it("grants ADMIN the permissions it should have", () => {
    expect(hasPermission("ADMIN", "organization.manage")).toBe(true);
    expect(hasPermission("ADMIN", "members.invite")).toBe(true);
    expect(hasPermission("ADMIN", "members.remove")).toBe(true);
    expect(hasPermission("ADMIN", "activity.viewOrganization")).toBe(true);
  });

  it("denies MEMBER every management permission — the default-deny case", () => {
    const permissions = [
      "organization.manage",
      "members.invite",
      "members.remove",
      "members.changeRole",
      "billing.manage",
      "featureFlags.manage",
      "activity.viewOrganization",
    ] as const;
    for (const permission of permissions) {
      expect(hasPermission("MEMBER", permission)).toBe(false);
    }
  });
});
