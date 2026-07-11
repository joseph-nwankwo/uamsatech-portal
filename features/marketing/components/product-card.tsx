import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/site-config";

const accentClasses: Record<Product["accent"], string> = {
  navy: "bg-navy/10 text-navy dark:bg-navy/30 dark:text-blue-100",
  gold: "bg-gold/15 text-[#8a6d10] dark:text-gold",
  blue: "bg-blue-accent/10 text-blue-accent",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="group relative flex h-full flex-col justify-between overflow-hidden p-6 transition-shadow hover:shadow-lg">
      <div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${accentClasses[product.accent]}`}
          >
            {product.name}
          </span>
          <Badge
            variant="outline"
            className="text-muted-foreground text-xs font-normal"
          >
            {product.subdomain}
          </Badge>
        </div>
        <h3 className="text-foreground mt-4 text-lg font-semibold">
          {product.tagline}
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          {product.description}
        </p>

        <ul className="mt-4 flex flex-wrap gap-1.5">
          {product.features.slice(0, 4).map((f) => (
            <li
              key={f}
              className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs"
            >
              {f}
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/products/${product.slug}`}
        className="text-foreground mt-6 inline-flex items-center gap-1.5 text-sm font-medium"
      >
        Learn more
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Card>
  );
}
