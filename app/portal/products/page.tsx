import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight, ExternalLink, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { H1, Muted } from "@/components/ui/typography";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { products as marketingProducts } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

export default async function PortalProductsPage() {
  const { user, activeMembership } = await getPortalContext();

  const subscriptions = await db.subscription.findMany({
    where: activeMembership
      ? { organizationId: activeMembership.organizationId }
      : { userId: user.id },
    include: { product: true },
  });

  const subscribedSlugs = new Set(subscriptions.map((s) => s.product.slug));

  return (
    <div className="mx-auto max-w-4xl">
      <H1 className="text-2xl sm:text-2xl">Products</H1>
      <Muted className="mt-1">
        {activeMembership
          ? `Products available to ${activeMembership.organization.name}.`
          : "Products you can subscribe to individually."}
      </Muted>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {marketingProducts.map((product) => {
          const subscribed = subscribedSlugs.has(product.slug);
          return (
            <div
              key={product.slug}
              className="border-border flex flex-col rounded-2xl border p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-foreground font-semibold">{product.name}</p>
                {subscribed ? (
                  <Badge className="bg-secondary text-secondary-foreground">
                    <CheckCircle2 className="size-3" />
                    Subscribed
                  </Badge>
                ) : (
                  <Badge variant="outline">Not subscribed</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-2 flex-1 text-sm">
                {product.tagline}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link href={`/products/${product.slug}`}>Learn more</Link>
                  }
                />
                {!subscribed && (
                  <Button
                    size="sm"
                    className="bg-navy hover:bg-navy/90 text-white"
                    render={
                      // Individual accounts can check out directly for any
                      // product with an "individual" pricing tier; anything
                      // institution/standalone-only stays sales-led.
                      activeMembership ||
                      product.pricingPlans.includes("individual") ? (
                        <Link href="/portal/billing">
                          Get access
                          <ArrowRight className="size-3.5" />
                        </Link>
                      ) : (
                        <Link href="/contact">
                          Get access
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )
                    }
                  />
                )}
                {subscribed && product.isLive && (
                  <Button
                    size="sm"
                    className="bg-navy hover:bg-navy/90 text-white"
                    render={
                      <a
                        href={`https://${product.subdomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Launch
                        <ExternalLink className="size-3.5" />
                      </a>
                    }
                  />
                )}
                {subscribed && !product.isLive && (
                  <Badge
                    variant="outline"
                    className="text-muted-foreground self-center"
                  >
                    <Clock className="size-3" />
                    Coming soon
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
