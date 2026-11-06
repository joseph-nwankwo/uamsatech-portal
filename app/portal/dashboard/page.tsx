import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  Activity,
  ArrowRight,
  ExternalLink,
  Clock,
  Grid2x2,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { H1, H3 } from "@/components/ui/typography";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { products as marketingProducts } from "@/lib/site-config";
import { productLaunchHref } from "@/lib/portal/launch-links";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function PortalDashboardPage() {
  const { user, activeMembership } = await getPortalContext();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [subscriptions, usage, recentActivity] = await Promise.all([
    db.subscription.findMany({
      where: activeMembership
        ? { organizationId: activeMembership.organizationId }
        : { userId: user.id },
      include: { product: true, productPlan: { include: { plan: true } } },
    }),
    activeMembership
      ? db.usageRecord.groupBy({
          by: ["productId", "metric"],
          where: {
            organizationId: activeMembership.organizationId,
            recordedAt: { gte: periodStart },
          },
          _sum: { quantity: true },
        })
      : Promise.resolve([]),
    db.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const subscribedSlugs = new Set(subscriptions.map((s) => s.product.slug));
  const ownedProducts = marketingProducts.filter((p) =>
    subscribedSlugs.has(p.slug)
  );

  const usageProductIds = [...new Set(usage.map((u) => u.productId))];
  const usageProducts = usageProductIds.length
    ? await db.product.findMany({ where: { id: { in: usageProductIds } } })
    : [];
  const usageProductNameById = new Map(
    usageProducts.map((p) => [p.id, p.name])
  );

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">
        Welcome, {user.name ?? user.email}
      </H1>
      <p className="text-muted-foreground mt-1 text-sm">{user.email}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-border rounded-2xl border p-6">
          <div className="text-foreground flex items-center gap-2 text-sm font-medium">
            {user.emailVerified ? (
              <>
                <CheckCircle2 className="text-navy dark:text-blue-accent size-4" />
                Email verified
              </>
            ) : (
              <>
                <AlertCircle className="text-destructive size-4" />
                Email not verified
              </>
            )}
          </div>
        </div>

        <div className="border-border rounded-2xl border p-6">
          <div className="text-foreground flex items-center gap-2 text-sm font-medium">
            <Building2 className="size-4" />
            {activeMembership
              ? activeMembership.organization.name
              : "Individual account"}
          </div>
          {activeMembership && (
            <Badge variant="outline" className="mt-2">
              {activeMembership.role}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick launch — one-tap access to every product, live ones jump
          straight out via SSO, unbuilt ones are labeled rather than linked. */}
      <div className="mt-8">
        <H3>Quick launch</H3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {marketingProducts.map((product) => {
            const subscribed = subscribedSlugs.has(product.slug);
            const canLaunch = subscribed && product.isLive;
            const content = (
              <>
                <span
                  className={`bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold ${!subscribed ? "opacity-50" : ""}`}
                >
                  {product.name.slice(0, 2).toUpperCase()}
                </span>
                <span
                  className={`mt-2 text-center text-xs font-medium ${subscribed ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {product.name}
                </span>
                {canLaunch ? (
                  <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[11px]">
                    Launch <ExternalLink className="size-2.5" />
                  </span>
                ) : !product.isLive ? (
                  <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[11px]">
                    <Clock className="size-2.5" />
                    Coming soon
                  </span>
                ) : (
                  <span className="text-muted-foreground mt-0.5 text-[11px]">
                    Not subscribed
                  </span>
                )}
              </>
            );
            const className =
              "border-border flex flex-col items-center rounded-xl border p-3 text-center transition-colors" +
              (canLaunch ? " hover:bg-muted" : " cursor-default");

            return canLaunch ? (
              <a
                key={product.slug}
                href={productLaunchHref(product)}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            ) : (
              <Link
                key={product.slug}
                href="/portal/products"
                className={className}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Owned products */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <H3>Owned products</H3>
          <Link
            href="/portal/products"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="mt-4">
          {ownedProducts.length === 0 ? (
            <EmptyState
              icon={Grid2x2}
              title="No products yet"
              description="Subscribe to a product to see it here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ownedProducts.map((product) => (
                <div
                  key={product.slug}
                  className="border-border flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {product.name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {product.tagline}
                    </p>
                  </div>
                  <Badge className="bg-secondary text-secondary-foreground">
                    <CheckCircle2 className="size-3" />
                    Owned
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <H3>Subscriptions</H3>
          <Link
            href="/portal/billing"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
          >
            Manage billing
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="mt-4">
          {subscriptions.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No active subscriptions"
              description="Subscribe to a product to see billing details here."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Renews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-foreground font-medium">
                        {sub.product.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sub.productPlan
                          ? `${sub.productPlan.plan.name} — ${formatPrice(
                              sub.productPlan.priceCents,
                              sub.productPlan.currency
                            )}/${sub.productPlan.interval === "MONTHLY" ? "mo" : "yr"}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sub.status === "ACTIVE" ? "default" : "outline"
                          }
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sub.cancelAtPeriodEnd
                          ? "Cancels at period end"
                          : (sub.currentPeriodEnd?.toLocaleDateString() ?? "—")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <H3>Usage this month</H3>
          <Link
            href="/portal/usage"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="mt-4">
          {usage.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No usage recorded this period"
              description="As your team uses UAMSATech products, metered activity will show up here."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.slice(0, 5).map((row) => (
                    <TableRow key={`${row.productId}-${row.metric}`}>
                      <TableCell className="text-foreground font-medium">
                        {usageProductNameById.get(row.productId) ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.metric}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row._sum.quantity ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <div className="border-border mt-8 rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4" />
            Recent activity
          </h2>
          <Link
            href="/portal/activity"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="text-muted-foreground text-sm">
                <span className="text-foreground font-medium">
                  {entry.action}
                </span>{" "}
                &mdash; {entry.createdAt.toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
