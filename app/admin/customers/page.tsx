import type { Metadata } from "next";
import { Building2, Users, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, H3, Muted } from "@/components/ui/typography";
import { SignupsChart } from "@/features/admin/components/signups-chart";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Customer Analytics",
  robots: { index: false, follow: false },
};

export default async function AdminCustomersPage() {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const [
    orgCount,
    userCount,
    recentUsers,
    subscriptionsByStatus,
    topOrgsByUsage,
  ] = await Promise.all([
    db.organization.count(),
    db.user.count(),
    db.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    db.usageRecord.groupBy({
      by: ["organizationId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const dayBuckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    dayBuckets.set(key, 0);
  }
  for (const user of recentUsers) {
    const key = user.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (dayBuckets.has(key)) {
      dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }
  }
  const chartData = [...dayBuckets.entries()].map(([day, signups]) => ({
    day,
    signups,
  }));

  const orgIds = topOrgsByUsage.map((u) => u.organizationId);
  const orgs = orgIds.length
    ? await db.organization.findMany({ where: { id: { in: orgIds } } })
    : [];
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">Customer Analytics</H1>
      <Muted className="mt-1">
        Real organization, user, and usage data across every customer.
      </Muted>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Building2 className="size-3.5" />
            Organizations
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {orgCount}
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Users className="size-3.5" />
            Total users
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {userCount}
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <TrendingUp className="size-3.5" />
            New signups (30d)
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {recentUsers.length}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <H3>Signups, last 30 days</H3>
        <div className="mt-4">
          <SignupsChart data={chartData} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <H3>Subscriptions by status</H3>
          <div className="mt-4 space-y-2">
            {subscriptionsByStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No subscriptions yet.
              </p>
            ) : (
              subscriptionsByStatus.map((row) => (
                <div
                  key={row.status}
                  className="border-border flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm"
                >
                  <Badge variant="outline">{row.status}</Badge>
                  <span className="text-muted-foreground">
                    {row._count._all}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <H3>Top organizations by usage</H3>
          <div className="mt-4">
            {topOrgsByUsage.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No usage recorded yet"
                description="Top organizations by metered usage will show up here."
              />
            ) : (
              <div className="space-y-2">
                {topOrgsByUsage.map((row) => (
                  <div
                    key={row.organizationId}
                    className="border-border flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm"
                  >
                    <span className="text-foreground font-medium">
                      {orgNameById.get(row.organizationId) ?? "Unknown"}
                    </span>
                    <span className="text-muted-foreground">
                      {row._sum.quantity ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
