import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SelectOrganizationForm } from "@/features/auth/components/select-organization-form";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Select organization",
  robots: { index: false, follow: false },
};

export default async function SelectOrganizationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await db.membership.findMany({
    where: { userId: session.sub },
    include: { organization: true },
  });

  if (memberships.length <= 1) redirect("/portal/dashboard");

  return (
    <AuthShell
      title="Select an organization"
      description="Choose which organization to continue with."
    >
      <SelectOrganizationForm
        memberships={memberships.map((m) => ({
          organizationId: m.organizationId,
          name: m.organization.name,
          role: m.role,
        }))}
      />
    </AuthShell>
  );
}
