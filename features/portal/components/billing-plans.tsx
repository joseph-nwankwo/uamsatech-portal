"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type ProductPlanInfo = {
  id: string;
  planName: string;
  productSlug: string;
  productName: string;
  interval: "MONTHLY" | "YEARLY";
  priceCents: number;
  currency: string;
  isStartingPrice: boolean;
  features: string[];
};

export type ProviderAvailability = {
  stripe: boolean;
  paystack: boolean;
  flutterwave: boolean;
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function BillingPlans({
  productPlans,
  providers,
  subscribedProductPlanIds,
}: {
  productPlans: ProductPlanInfo[];
  providers: ProviderAvailability;
  subscribedProductPlanIds: Set<string>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  async function checkout(
    productPlanId: string,
    provider: "stripe" | "paystack" | "flutterwave"
  ) {
    setPending(`${productPlanId}:${provider}`);
    setError(null);
    const res = await fetch(`/api/billing/${provider}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productPlanId,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong starting checkout.");
      return;
    }
    window.location.href = data.url;
  }

  const anyProviderAvailable =
    providers.stripe || providers.paystack || providers.flutterwave;

  const byProduct = new Map<string, ProductPlanInfo[]>();
  for (const p of productPlans) {
    const list = byProduct.get(p.productSlug) ?? [];
    list.push(p);
    byProduct.set(p.productSlug, list);
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-destructive text-sm">{error}</p>}
      {!anyProviderAvailable && (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Payment providers aren&apos;t configured in this environment yet.
          Plans are shown for reference — checkout isn&apos;t live here.
        </p>
      )}
      {anyProviderAvailable && (
        <div className="max-w-xs">
          <label
            htmlFor="coupon-code"
            className="text-foreground text-sm font-medium"
          >
            Have a coupon code?
          </label>
          <Input
            id="coupon-code"
            placeholder="e.g. LAUNCH20"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="mt-1.5"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Applied automatically to whichever plan you check out with below.
          </p>
        </div>
      )}
      {[...byProduct.entries()].map(([productSlug, plans]) => (
        <div key={productSlug}>
          <p className="text-foreground text-sm font-semibold">
            {plans[0].productName}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const subscribed = subscribedProductPlanIds.has(plan.id);
              return (
                <div
                  key={plan.id}
                  className="border-border flex flex-col rounded-2xl border p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-foreground font-semibold">
                      {plan.planName}
                    </p>
                    {subscribed && <Badge>Current</Badge>}
                  </div>
                  <p className="text-foreground mt-2 text-xl font-semibold">
                    {plan.priceCents === 0
                      ? "Free"
                      : formatPrice(plan.priceCents, plan.currency)}
                    {plan.priceCents > 0 && (
                      <span className="text-muted-foreground text-sm font-normal">
                        /{plan.interval === "MONTHLY" ? "mo" : "yr"}
                      </span>
                    )}
                  </p>
                  {plan.isStartingPrice && (
                    <p className="text-muted-foreground text-xs">
                      Starting price — final quote varies
                    </p>
                  )}
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs">
                        <Check className="text-navy dark:text-blue-accent mt-0.5 size-3.5 shrink-0" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!subscribed && plan.priceCents > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {providers.stripe && (
                        <Button
                          size="xs"
                          className="bg-navy hover:bg-navy/90 text-white"
                          loading={pending === `${plan.id}:stripe`}
                          onClick={() => checkout(plan.id, "stripe")}
                        >
                          Stripe
                        </Button>
                      )}
                      {providers.paystack && (
                        <Button
                          size="xs"
                          variant="outline"
                          loading={pending === `${plan.id}:paystack`}
                          onClick={() => checkout(plan.id, "paystack")}
                        >
                          Paystack
                        </Button>
                      )}
                      {providers.flutterwave && (
                        <Button
                          size="xs"
                          variant="outline"
                          loading={pending === `${plan.id}:flutterwave`}
                          onClick={() => checkout(plan.id, "flutterwave")}
                        >
                          Flutterwave
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
