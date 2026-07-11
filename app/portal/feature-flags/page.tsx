import type { Metadata } from "next";
import { Flag } from "lucide-react";
import { H1, Muted } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { FeatureFlagsList } from "@/features/portal/components/feature-flags-list";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Feature Flags",
  robots: { index: false, follow: false },
};

export default async function FeatureFlagsPage() {
  const { activeMembership } = await getPortalContext();
  const isOwner = activeMembership?.role === "OWNER";

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Feature Flags</H1>
      <Muted className="mt-1">
        Control which experimental capabilities are enabled for your
        organization.
      </Muted>

      <div className="mt-8">
        {!isOwner ? (
          <EmptyState
            icon={Flag}
            title="Owners only"
            description="Only organization owners can view and manage feature flags."
          />
        ) : (
          <FeatureFlagsListLoader />
        )}
      </div>
    </div>
  );
}

async function FeatureFlagsListLoader() {
  const flags = await db.featureFlag.findMany({ orderBy: { name: "asc" } });

  if (flags.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="No feature flags yet"
        description="Flags will show up here once they're created."
      />
    );
  }

  return (
    <FeatureFlagsList
      flags={flags.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        description: f.description,
        isEnabled: f.isEnabled,
      }))}
    />
  );
}
