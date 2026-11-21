import type { Metadata } from "next";
import { Flag } from "lucide-react";
import { H1, Muted } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { FeatureFlagsList } from "@/features/admin/components/feature-flags-list";
import { getAdminContext } from "@/lib/admin/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Feature Flags",
  robots: { index: false, follow: false },
};

export default async function AdminFeatureFlagsPage() {
  await getAdminContext();
  const flags = await db.featureFlag.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Feature Flags</H1>
      <Muted className="mt-1">
        Platform-wide switches. Changes apply to every customer immediately and
        are recorded in the audit log.
      </Muted>

      <div className="mt-8">
        {flags.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No feature flags yet"
            description="Flags will show up here once they're created."
          />
        ) : (
          <FeatureFlagsList
            flags={flags.map((f) => ({
              id: f.id,
              key: f.key,
              name: f.name,
              description: f.description,
              isEnabled: f.isEnabled,
            }))}
          />
        )}
      </div>
    </div>
  );
}
