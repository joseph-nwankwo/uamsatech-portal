import { KeyRound, Layers, Globe } from "lucide-react";
import type { Product } from "@/types/product";

export function TrustPoints({ product }: { product: Product }) {
  const points = [
    {
      icon: KeyRound,
      title: "One account, every product",
      description:
        "Single sign-on through auth.uamsatech.com — no separate registration if you also use another UAMSATech product.",
    },
    {
      icon: Layers,
      title: "Deploy the way you work",
      description: `${product.name} supports ${product.deployment.join(", ").toLowerCase()}, so you're not locked into one rollout model.`,
    },
    {
      icon: Globe,
      title: "Built for Africa first",
      description:
        "Local payment support (Paystack, Flutterwave) alongside Stripe, and pricing that works for individuals and institutions alike.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-foreground text-center text-2xl font-semibold tracking-tight">
        Why teams choose {product.name}
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {points.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex flex-col items-center text-center">
            <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-11 w-11 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </div>
            <h3 className="text-foreground mt-4 font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
