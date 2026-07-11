import type { Metadata } from "next";
import { Receipt } from "lucide-react";
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
import { BillingPlans } from "@/features/portal/components/billing-plans";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { products as marketingProducts } from "@/lib/site-config";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { isPaystackConfigured } from "@/lib/billing/paystack";
import { isFlutterwaveConfigured } from "@/lib/billing/flutterwave";
import { isFeatureEnabled } from "@/lib/billing/feature-flags";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function BillingPage() {
  const { user, activeMembership } = await getPortalContext();

  // Org billing shows every plan; an individual (no active org) only ever
  // sees plans on products that actually offer an "individual" tier
  // (lib/site-config.ts) — the rest are institution/standalone-only and
  // stay sales-led.
  const individualSlugs = new Set(
    marketingProducts
      .filter((p) => p.pricingPlans.includes("individual"))
      .map((p) => p.slug)
  );

  const [
    productPlans,
    subscriptions,
    invoices,
    paystackEnabled,
    flutterwaveEnabled,
  ] = await Promise.all([
    db.productPlan.findMany({
      where: { isActive: true },
      include: { product: true, plan: true },
      orderBy: [{ product: { name: "asc" } }, { plan: { sortOrder: "asc" } }],
    }),
    activeMembership
      ? db.subscription.findMany({
          where: { organizationId: activeMembership.organizationId },
        })
      : db.subscription.findMany({ where: { userId: user.id } }),
    activeMembership
      ? db.invoice.findMany({
          where: { organizationId: activeMembership.organizationId },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : db.invoice.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
    isFeatureEnabled("billing_paystack_enabled"),
    isFeatureEnabled("billing_flutterwave_enabled"),
  ]);

  const subscribedProductPlanIds = new Set(
    subscriptions
      .filter((s) => s.productPlanId)
      .map((s) => s.productPlanId as string)
  );

  const visiblePlans = activeMembership
    ? productPlans
    : productPlans.filter((p) => individualSlugs.has(p.product.slug));

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">Billing</H1>
      <Muted className="mt-1">
        {activeMembership
          ? `Manage ${activeMembership.organization.name}'s plans and view invoice history.`
          : "Manage your individual plans and view invoice history."}
      </Muted>

      <div className="mt-8">
        <H3>Plans</H3>
        <div className="mt-4">
          {!activeMembership && visiblePlans.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No individual plans available"
              description="The products with an individual tier don't have active plans configured right now. Check back soon, or contact us about an institutional plan."
            />
          ) : (
            <BillingPlans
              productPlans={visiblePlans.map((p) => ({
                id: p.id,
                planName: p.plan.name,
                productSlug: p.product.slug,
                productName: p.product.name,
                interval: p.interval,
                priceCents: p.priceCents,
                currency: p.currency,
                isStartingPrice: p.isStartingPrice,
                features: p.features,
              }))}
              providers={{
                stripe: isStripeConfigured(),
                paystack: isPaystackConfigured() && paystackEnabled,
                flutterwave: isFlutterwaveConfigured() && flutterwaveEnabled,
              }}
              subscribedProductPlanIds={subscribedProductPlanIds}
            />
          )}
        </div>
      </div>

      <div className="mt-12">
        <H3>Invoices</H3>
        <div className="mt-4">
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description={
                activeMembership
                  ? "Invoices will appear here once your organization has an active subscription."
                  : "Invoices will appear here once you have an active subscription."
              }
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-muted-foreground">
                        {invoice.createdAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {formatPrice(invoice.amountCents, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.provider}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "PAID" ? "default" : "outline"
                          }
                        >
                          {invoice.status}
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
