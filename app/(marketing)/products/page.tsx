import type { Metadata } from "next";
import { ProductGrid } from "@/features/marketing/components/product-grid";
import { Integrations } from "@/features/marketing/components/integrations";
import { CtaSection } from "@/features/marketing/components/cta-section";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Explore UAMSA, LecturerCraft, ScholarCraft, Records, and StudyFlow — the UAMSATech product ecosystem for universities, lecturers, researchers, and students.",
  alternates: { canonical: "/products" },
};

export default function ProductsPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          One ecosystem, five products
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          Every product is built to stand alone, and to work seamlessly together
          through a single UAMSATech account.
        </p>
      </section>

      <ProductGrid />
      <Integrations />
      <CtaSection />
    </>
  );
}
