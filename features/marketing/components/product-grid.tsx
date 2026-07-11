import { products } from "@/lib/site-config";
import { ProductCard } from "@/features/marketing/components/product-card";

export function ProductGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          One ecosystem, five products
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          Each product stands on its own, and works even better together through
          single sign-on and shared data with UAMSA.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}
