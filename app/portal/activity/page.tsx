import type { Metadata } from "next";
import { Activity } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { H1, Muted } from "@/components/ui/typography";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/portal/permissions";

export const metadata: Metadata = {
  title: "Recent Activity",
  robots: { index: false, follow: false },
};

const actionLabels: Record<string, string> = {
  "user.login": "Signed in",
  "user.logout": "Signed out",
  "user.password_reset": "Reset password",
  "user.password_changed": "Changed password",
  "user.profile_updated": "Updated profile",
  "user.settings_updated": "Updated settings",
  "organization.updated": "Updated organization",
  "organization.left": "Left the organization",
  "session.revoked": "Revoked a session",
  "api_key.created": "Created an API key",
  "api_key.revoked": "Revoked an API key",
  "billing.checkout_started": "Started checkout",
  "billing.subscription_activated": "Activated a subscription",
  "billing.subscription_canceled": "Canceled a subscription",
  "billing.invoice_paid": "Invoice paid",
  "feature_flag.updated": "Updated a feature flag",
  "member.invited": "Invited a member",
  "member.invitation_revoked": "Revoked an invitation",
  "member.invitation_accepted": "Joined the organization",
  "member.role_changed": "Changed a member's role",
  "member.removed": "Removed a member",
};

export default async function ActivityPage() {
  const { user, activeMembership } = await getPortalContext();

  const viewOrganization =
    activeMembership &&
    hasPermission(
      activeMembership.role as UserRole,
      "activity.viewOrganization"
    );

  const entries = viewOrganization
    ? await db.auditLog.findMany({
        where: { organizationId: activeMembership.organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true },
      })
    : await db.auditLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true },
      });

  return (
    <div className="mx-auto max-w-3xl">
      <H1 className="text-2xl sm:text-2xl">Recent Activity</H1>
      <Muted className="mt-1">
        {viewOrganization
          ? `Security-relevant actions across ${activeMembership.organization.name}.`
          : "A log of security-relevant actions on your account."}
      </Muted>

      {entries.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Activity}
            title="No activity recorded yet"
            description="Actions like signing in, changing your password, or updating your profile will show up here."
          />
        </div>
      ) : (
        <div className="border-border mt-8 overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {viewOrganization && <TableHead>Who</TableHead>}
                <TableHead>Action</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  {viewOrganization && (
                    <TableCell className="text-muted-foreground">
                      {entry.user?.id === user.id
                        ? "You"
                        : (entry.user?.name ?? entry.user?.email ?? "—")}
                    </TableCell>
                  )}
                  <TableCell className="text-foreground font-medium">
                    {actionLabels[entry.action] ?? entry.action}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.createdAt.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
