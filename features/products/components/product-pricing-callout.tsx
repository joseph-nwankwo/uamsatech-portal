import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types/product";

const planDetails: Record<
  Product["pricingPlans"][number],
  { name: string; price: string; description: string; features: string[] }
> = {
  individual: {
    name: "Individual",
    price: "From ₦0",
    description: "Get started on your own, no institution required.",
    features: [
      "Single sign-on account",
      "Core AI tools included",
      "Email support",
    ],
  },
  institution: {
    name: "Institution",
    price: "Custom",
    description: "Institution-wide deployment with dedicated onboarding.",
    features: [
      "Institution-wide deployment",
      "Single sign-on across products",
      "Dedicated onboarding & support",
    ],
  },
  standalone: {
    name: "Standalone / Third-party",
    price: "Custom",
    description: "Use independently, or alongside your existing SIS.",
    features: [
      "Standalone deployment",
      "Third-party SIS integration",
      "Priority support",
    ],
  },
};

export function ProductPricingCallout({ product }: { product: Product }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {product.pricingPlans.map((plan) => {
        const details = planDetails[plan];
        return (
          <div
            key={plan}
            className="border-border bg-card flex flex-col rounded-2xl border p-6"
          >
            <p className="text-foreground font-semibold">{details.name}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold">
              {details.price}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {details.description}
            </p>
            <ul className="mt-4 flex-1 space-y-2">
              {details.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="text-navy dark:text-blue-accent mt-0.5 size-4 shrink-0" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="sm:col-span-2">
        <Button
          variant="outline"
          render={<Link href="/pricing">See full pricing details</Link>}
        />
      </div>
    </div>
  );
}
