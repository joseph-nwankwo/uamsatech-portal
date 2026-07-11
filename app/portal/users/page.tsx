import type { Metadata } from "next";
import { Users, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { H1, H3, Muted } from "@/components/ui/typography";
import { InviteMemberDialog } from "@/features/portal/components/invite-member-dialog";
import { TeamMembersTable } from "@/features/portal/components/team-members-table";
import { PendingInvitationsTable } from "@/features/portal/components/pending-invitations-table";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { hasPermission, ROLE_DESCRIPTIONS } from "@/lib/portal/permissions";
import type { UserRole } from "@prisma/client";

export const metadata: Metadata = {
  title: "Team Members",
  robots: { index: false, follow: false },
};

export default async function UsersPage() {
  const { activeMembership, user } = await getPortalContext();

  if (!activeMembership) {
    return (
      <div className="mx-auto max-w-2xl">
        <H1 className="text-2xl sm:text-2xl">Team Members</H1>
        <div className="mt-8">
          <EmptyState
            icon={Users}
            title="No team to manage"
            description="Individual accounts don't have team members. This page lists everyone in your organization once you're part of one."
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

  const role = activeMembership.role as UserRole;
  const canInvite = hasPermission(role, "members.invite");
  const canRemove = hasPermission(role, "members.remove");
  const canChangeRoles = hasPermission(role, "members.changeRole");

  const [memberships, invitations] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: activeMembership.organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    canInvite
      ? db.invitation.findMany({
          where: {
            organizationId: activeMembership.organizationId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <H1 className="text-2xl sm:text-2xl">Team Members</H1>
          <Muted className="mt-1">
            Everyone with access to {activeMembership.organization.name}.
          </Muted>
        </div>
        {canInvite && <InviteMemberDialog canInviteOwner={role === "OWNER"} />}
      </div>

      <div className="mt-8">
        <TeamMembersTable
          members={memberships.map((m) => ({
            membershipId: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            joinedAt: m.createdAt.toISOString(),
          }))}
          currentUserId={user.id}
          canChangeRoles={canChangeRoles}
          canRemove={canRemove}
          currentUserRole={role}
        />
      </div>

      {canInvite && invitations.length > 0 && (
        <div className="mt-10">
          <H3 className="text-base">Pending invitations</H3>
          <div className="mt-3">
            <PendingInvitationsTable
              invitations={invitations.map((i) => ({
                id: i.id,
                email: i.email,
                role: i.role,
                expiresAt: i.expiresAt.toISOString(),
              }))}
              canRevoke={canInvite}
            />
          </div>
        </div>
      )}

      <div className="border-border mt-10 rounded-xl border p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-navy dark:text-blue-accent size-4" />
          <H3 className="text-sm">Roles &amp; permissions</H3>
        </div>
        <dl className="mt-3 space-y-3">
          {(Object.entries(ROLE_DESCRIPTIONS) as [UserRole, string][]).map(
            ([roleName, description]) => (
              <div key={roleName}>
                <dt className="text-foreground text-sm font-medium">
                  {roleName.charAt(0) + roleName.slice(1).toLowerCase()}
                </dt>
                <dd className="text-muted-foreground text-sm">{description}</dd>
              </div>
            )
          )}
        </dl>
      </div>
    </div>
  );
}
