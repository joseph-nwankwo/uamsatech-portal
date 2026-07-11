import type { Metadata } from "next";
import { DollarSign, TrendingUp, Receipt } from "lucide-react";
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
import { H1, H3, Muted } from "@/components/ui/typography";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Revenue",
  robots: { index: false, follow: false },
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminRevenuePage() {
  const [paidInvoices, activeSubscriptions, recentInvoices] = await Promise.all(
    [
      db.invoice.findMany({ where: { status: "PAID" } }),
      db.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { productPlan: true, product: true },
      }),
      db.invoice.findMany({
        include: {
          subscription: {
            include: { organization: true, user: true, product: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]
  );

  const totalRevenueCents = paidInvoices.reduce(
    (sum, inv) => sum + inv.amountCents,
    0
  );

  // MRR: normalize every active subscription's plan price to a monthly
  // figure (yearly / 12). Subscriptions with no plan (e.g. UAMSA, which is
  // quotation-only per Phase 7) contribute nothing — there's no real number
  // to estimate them with, so they're honestly excluded rather than guessed.
  const mrrCents = activeSubscriptions.reduce((sum, sub) => {
    if (!sub.productPlan) return sum;
    const monthly =
      sub.productPlan.interval === "YEARLY"
        ? sub.productPlan.priceCents / 12
        : sub.productPlan.priceCents;
    return sum + monthly;
  }, 0);

  const revenueByProduct = new Map<string, number>();
  for (const inv of recentInvoices) {
    const name = inv.subscription.product.name;
    revenueByProduct.set(
      name,
      (revenueByProduct.get(name) ?? 0) + inv.amountCents
    );
  }

  const revenueByProvider = new Map<string, number>();
  for (const inv of paidInvoices) {
    revenueByProvider.set(
      inv.provider,
      (revenueByProvider.get(inv.provider) ?? 0) + inv.amountCents
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">Revenue</H1>
      <Muted className="mt-1">
        Computed from real `Invoice` and `Subscription` records — this will read
        close to zero until real payment providers are configured and customers
        actually subscribe.
      </Muted>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <DollarSign className="size-3.5" />
            Total revenue (all-time, paid)
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {formatPrice(totalRevenueCents, "USD")}
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <TrendingUp className="size-3.5" />
            MRR estimate
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {formatPrice(mrrCents, "USD")}
          </p>
        </div>
        <div className="border-border rounded-2xl border p-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Receipt className="size-3.5" />
            Active subscriptions
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {activeSubscriptions.length}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <H3>Revenue by product</H3>
          <div className="mt-4 space-y-2">
            {revenueByProduct.size === 0 ? (
              <p className="text-muted-foreground text-sm">
                No paid invoices yet.
              </p>
            ) : (
              [...revenueByProduct.entries()].map(([name, cents]) => (
                <div
                  key={name}
                  className="border-border flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm"
                >
                  <span className="text-foreground font-medium">{name}</span>
                  <span className="text-muted-foreground">
                    {formatPrice(cents, "USD")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <H3>Revenue by provider</H3>
          <div className="mt-4 space-y-2">
            {revenueByProvider.size === 0 ? (
              <p className="text-muted-foreground text-sm">
                No paid invoices yet.
              </p>
            ) : (
              [...revenueByProvider.entries()].map(([provider, cents]) => (
                <div
                  key={provider}
                  className="border-border flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm"
                >
                  <Badge variant="outline">{provider}</Badge>
                  <span className="text-muted-foreground">
                    {formatPrice(cents, "USD")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <H3>Recent invoices</H3>
        <div className="mt-4">
          {recentInvoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Invoices from real payments will show up here."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Billed to</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-muted-foreground">
                        {inv.createdAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {inv.subscription.organization?.name ??
                          inv.subscription.user?.email ??
                          "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.subscription.product.name}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {formatPrice(inv.amountCents, inv.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.provider}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "PAID" ? "default" : "outline"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
