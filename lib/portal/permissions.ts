import type { UserRole } from "@prisma/client";

export type Permission =
  | "organization.manage" // rename org, org settings
  | "members.invite"
  | "members.remove"
  | "members.changeRole"
  | "billing.manage"
  | "featureFlags.manage"
  | "activity.viewOrganization"; // see everyone's activity, not just your own

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    "organization.manage",
    "members.invite",
    "members.remove",
    "members.changeRole",
    "billing.manage",
    "featureFlags.manage",
    "activity.viewOrganization",
  ],
  ADMIN: [
    "organization.manage",
    "members.invite",
    "members.remove",
    "activity.viewOrganization",
  ],
  MEMBER: [],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER:
    "Full control: organization settings, billing, feature flags, and can change or remove any member, including other admins.",
  ADMIN:
    "Can invite and remove members, update organization settings, and view organization-wide activity. Cannot manage billing, feature flags, or change member roles.",
  MEMBER:
    "Can access subscribed products and view their own account activity. Cannot manage the organization, members, or billing.",
};
