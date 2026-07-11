import type { Metadata } from "next";
import { Activity, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, H3, Muted } from "@/components/ui/typography";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Product Analytics",
  robots: { index: false, follow: false },
};

const EVENT_LABELS: Record<string, string> = {
  signup_completed: "Signups completed",
  login: "Logins",
  email_verified: "Emails verified",
  contact_submitted: "Contact forms submitted",
  newsletter_subscribed: "Newsletter subscriptions",
  subscription_created: "Subscriptions created",
};

export default async function AdminProductPage() {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 29);

  const [eventCounts, usageByProduct] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.usageRecord.groupBy({
      by: ["productId", "metric"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
    }),
  ]);

  const productIds = [...new Set(usageByProduct.map((u) => u.productId))];
  const products = productIds.length
    ? await db.product.findMany({ where: { id: { in: productIds } } })
    : [];
  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">Product Analytics</H1>
      <Muted className="mt-1">
        Real first-party events (last 30 days) and metered usage across every
        organization.
      </Muted>

      <div className="mt-8">
        <H3>Events, last 30 days</H3>
        <div className="mt-4">
          {eventCounts.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No events recorded yet"
              description="Signups, logins, and other tracked actions will show up here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {eventCounts.map((row) => (
                <div
                  key={row.name}
                  className="border-border flex items-center justify-between rounded-xl border p-4 text-sm"
                >
                  <span className="text-foreground font-medium">
                    {EVENT_LABELS[row.name] ?? row.name}
                  </span>
                  <span className="text-muted-foreground">
                    {row._count._all}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <H3>Usage by product, all-time</H3>
        <div className="mt-4">
          {usageByProduct.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No usage recorded yet"
              description="Metered usage reported via /api/v1/usage will show up here."
            />
          ) : (
            <div className="space-y-2">
              {usageByProduct.map((row) => (
                <div
                  key={`${row.productId}-${row.metric}`}
                  className="border-border flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm"
                >
                  <span className="text-foreground font-medium">
                    {productNameById.get(row.productId) ?? "Unknown"}
                  </span>
                  <span className="text-muted-foreground">
                    {row.metric}: {row._sum.quantity ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
