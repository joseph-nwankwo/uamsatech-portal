import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { H1, H3, Muted } from "@/components/ui/typography";
import { OrganizationForm } from "@/features/portal/components/organization-form";
import { LeaveOrganizationCard } from "@/features/portal/components/leave-organization-card";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/portal/permissions";
import type { UserRole } from "@prisma/client";

export const metadata: Metadata = {
  title: "Organization",
  robots: { index: false, follow: false },
};

export default async function OrganizationPage() {
  const { activeMembership } = await getPortalContext();

  if (!activeMembership) {
    return (
      <div className="mx-auto max-w-2xl">
        <H1 className="text-2xl sm:text-2xl">Organization</H1>
        <div className="mt-8">
          <EmptyState
            icon={Building2}
            title="You're not part of an organization"
            description="Individual accounts aren't tied to an organization. If your institution is adopting UAMSATech, get in touch and we'll set one up."
            action={
              <Button
                className="bg-navy hover:bg-navy/90 text-white"
                render={<a href="/contact">Contact us</a>}
              />
            }
          />
        </div>
      </div>
    );
  }

  const memberCount = await db.membership.count({
    where: { organizationId: activeMembership.organizationId },
  });
  const role = activeMembership.role as UserRole;
  const canEdit = hasPermission(role, "organization.manage");

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Organization</H1>
      <Muted className="mt-1">
        {memberCount} member{memberCount === 1 ? "" : "s"} &middot; created{" "}
        {activeMembership.organization.createdAt.toLocaleDateString()}
      </Muted>

      <div className="mt-8">
        <H3 className="text-sm">Institution profile</H3>
        <div className="border-border mt-3 rounded-2xl border p-6">
          {canEdit ? (
            <OrganizationForm
              initialName={activeMembership.organization.name}
            />
          ) : (
            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">
                {activeMembership.organization.name}
              </p>
              <Badge variant="outline">{activeMembership.role}</Badge>
              <p className="text-muted-foreground mt-3 text-sm">
                Only owners and admins can rename the organization.
              </p>
            </div>
          )}
        </div>
      </div>

      <LeaveOrganizationCard
        organizationName={activeMembership.organization.name}
      />
    </div>
  );
}
