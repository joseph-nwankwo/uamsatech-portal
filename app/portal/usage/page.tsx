import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { H1, Muted } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Usage",
  robots: { index: false, follow: false },
};

export default async function UsagePage() {
  const { activeMembership } = await getPortalContext();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const usage = activeMembership
    ? await db.usageRecord.groupBy({
        by: ["productId", "metric"],
        where: {
          organizationId: activeMembership.organizationId,
          recordedAt: { gte: periodStart },
        },
        _sum: { quantity: true },
      })
    : [];

  const productIds = [...new Set(usage.map((u) => u.productId))];
  const products = productIds.length
    ? await db.product.findMany({ where: { id: { in: productIds } } })
    : [];
  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Usage</H1>
      <Muted className="mt-1">
        {activeMembership
          ? `${activeMembership.organization.name}'s usage since ${periodStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
          : "Usage is tracked at the organization level."}
      </Muted>

      <div className="mt-8">
        {!activeMembership ? (
          <EmptyState
            icon={BarChart3}
            title="No organization selected"
            description="Usage is tracked per organization. Individual accounts don't have usage to show yet."
          />
        ) : usage.length === 0 ? (
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
                {usage.map((row) => (
                  <TableRow key={`${row.productId}-${row.metric}`}>
                    <TableCell className="text-foreground font-medium">
                      {productNameById.get(row.productId) ?? "Unknown"}
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
  );
}
