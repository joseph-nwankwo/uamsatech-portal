import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Faq } from "@/features/marketing/components/faq";
import { CtaSection } from "@/features/marketing/components/cta-section";
import { products } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for every UAMSATech product — for individual lecturers, students, researchers, and universities of any size.",
  alternates: { canonical: "/pricing" },
};

const plans = [
  {
    name: "Individual",
    price: "From ₦0",
    description:
      "For individual lecturers, students, and researchers getting started with LecturerCraft, ScholarCraft, or StudyFlow.",
    features: [
      "Access to one product",
      "Single sign-on account",
      "Core AI tools included",
      "Email support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Institution",
    price: "Custom",
    description:
      "For universities deploying UAMSA, or any product institution-wide with full integration.",
    features: [
      "All five products available",
      "Institution-wide deployment",
      "Single sign-on across products",
      "Dedicated onboarding & support",
      "Custom data & integration options",
    ],
    cta: "Talk to sales",
    highlighted: true,
  },
  {
    name: "Standalone / Third-party",
    price: "Custom",
    description:
      "For registrars and examination offices using Records independently or alongside an existing SIS.",
    features: [
      "Standalone Records deployment",
      "Third-party SIS integration",
      "QR verification & result processing",
      "Priority support",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

const faqItems = [
  {
    question: "How is UAMSA priced?",
    answer:
      "UAMSA is deployed at the institution level only. Reach out to our team for a custom quote based on student population and modules needed.",
  },
  {
    question: "Can I mix individual and institutional plans?",
    answer:
      "Yes. For example, a university can deploy UAMSA institution-wide while individual lecturers separately subscribe to LecturerCraft, all under single sign-on.",
  },
  {
    question: "What payment methods do you support?",
    answer:
      "We support Stripe, Paystack, and Flutterwave, so institutions and individuals across Africa and beyond can pay in their local currency.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Individual plans for LecturerCraft, ScholarCraft, and StudyFlow include a free tier to get started. Institutional plans include a guided pilot before full rollout.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          Whether you&apos;re an individual lecturer or a full university,
          there&apos;s a plan that fits.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-navy bg-navy text-white shadow-xl lg:-translate-y-4"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlighted && (
                <Badge className="bg-gold text-navy mb-4 w-fit">
                  Most popular
                </Badge>
              )}
              <h2
                className={`text-xl font-semibold ${plan.highlighted ? "text-white" : "text-foreground"}`}
              >
                {plan.name}
              </h2>
              <p
                className={`mt-4 text-3xl font-semibold ${plan.highlighted ? "text-white" : "text-foreground"}`}
              >
                {plan.price}
              </p>
              <p
                className={`mt-3 text-sm ${plan.highlighted ? "text-white/70" : "text-muted-foreground"}`}
              >
                {plan.description}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${plan.highlighted ? "text-gold" : "text-navy dark:text-blue-accent"}`}
                    />
                    <span
                      className={
                        plan.highlighted ? "text-white/90" : "text-foreground"
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                className={`mt-8 ${plan.highlighted ? "bg-gold text-navy hover:bg-gold/90" : "bg-navy hover:bg-navy/90 text-white"}`}
                render={<Link href="/contact">{plan.cta}</Link>}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-foreground text-center text-2xl font-semibold tracking-tight">
          Pricing by product
        </h2>
        <div className="border-border mt-10 overflow-x-auto rounded-xl border">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Deployment</TableHead>
                <TableHead>Pricing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.slug}>
                  <TableCell className="text-foreground font-medium">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.deployment.join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.deployment.includes("Institution only")
                      ? "Custom institutional quote"
                      : "Free tier, or custom institutional quote"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <Faq items={faqItems} />
      <CtaSection />
    </>
  );
}
