import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  ClipboardList,
  UserCog,
  TrendingUp,
  NotebookPen,
  HelpCircle,
  Bot,
  FileText,
  Quote,
  Search,
  FileCheck,
  QrCode,
  FileSpreadsheet,
  Calendar,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Faq } from "@/features/marketing/components/faq";
import { CtaSection } from "@/features/marketing/components/cta-section";
import { ProductMockup } from "@/features/products/components/product-mockup";
import { ProductPricingCallout } from "@/features/products/components/product-pricing-callout";
import { TrustPoints } from "@/features/products/components/trust-points";
import { products } from "@/lib/site-config";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

const faqByProduct: Record<string, { question: string; answer: string }[]> = {
  uamsa: [
    {
      question: "Can UAMSA integrate with our existing systems?",
      answer:
        "Yes. UAMSA supports third-party SIS integration and shares single sign-on with every other UAMSATech product.",
    },
    {
      question: "Is UAMSA available for individual purchase?",
      answer:
        "No. UAMSA is deployed at the institution level only, as a full university ERP and SIS.",
    },
  ],
  LectureSuite: [
    {
      question: "Can I use LectureSuite without my university subscribing?",
      answer:
        "Yes. LectureSuite is available to individual lecturers, and also works as an institution-wide deployment integrated with UAMSA.",
    },
  ],
  ScholarSuite: [
    {
      question: "Who is ScholarSuite for?",
      answer:
        "Students and researchers writing theses, dissertations, proposals, and journal articles, as well as universities offering it institution-wide.",
    },
  ],
  records: [
    {
      question: "Can Records work with our current student information system?",
      answer:
        "Yes. Records supports third-party SIS integration in addition to standalone use and integration with UAMSA.",
    },
  ],
  studyflow: [
    {
      question: "Does StudyFlow require a university subscription?",
      answer:
        "No. Students can use StudyFlow individually, and universities can also offer it institution-wide integrated with UAMSA.",
    },
  ],
};

const mockupPanels: Record<string, { icon: LucideIcon; label: string }[]> = {
  uamsa: [
    { icon: ClipboardList, label: "Admissions" },
    { icon: UserCog, label: "Student management" },
    { icon: TrendingUp, label: "Analytics" },
  ],
  LectureSuite: [
    { icon: NotebookPen, label: "Lecture notes" },
    { icon: HelpCircle, label: "Question generator" },
    { icon: Bot, label: "AI teaching assistant" },
  ],
  ScholarSuite: [
    { icon: FileText, label: "Thesis writing" },
    { icon: Quote, label: "Citation management" },
    { icon: Search, label: "Research assistant" },
  ],
  records: [
    { icon: FileCheck, label: "Transcript generator" },
    { icon: QrCode, label: "QR verification" },
    { icon: FileSpreadsheet, label: "Excel import" },
  ],
  studyflow: [
    { icon: Calendar, label: "Study planner" },
    { icon: Bot, label: "AI tutor" },
    { icon: Target, label: "Goal tracking" },
  ],
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: product.name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description: product.description,
    url: `https://${product.subdomain}`,
    audience: product.audience.map((a) => ({ "@type": "Audience", name: a })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-12 text-center sm:px-6 lg:px-8">
        <Badge
          variant="outline"
          className="text-muted-foreground text-xs font-normal"
        >
          {product.subdomain}
        </Badge>
        <h1 className="text-foreground mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          {product.name}
        </h1>
        <p className="text-muted-foreground mt-2 text-xl">{product.tagline}</p>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          {product.description}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="bg-navy hover:bg-navy/90 text-white"
            render={
              <Link href="/contact">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            }
          />
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/pricing">View pricing</Link>}
          />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
              Features
            </h2>
            <ul className="mt-6 space-y-3">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="text-navy dark:text-blue-accent mt-0.5 size-4 shrink-0" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-10">
            <div>
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Built for
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {product.audience.map((a) => (
                  <Badge
                    key={a}
                    className="bg-secondary text-secondary-foreground"
                  >
                    {a}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Deployment
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {product.deployment.map((d) => (
                  <Badge key={d} variant="outline">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-muted/30 border-border border-y">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-foreground text-center text-2xl font-semibold tracking-tight">
            Why it matters
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {product.benefits.map((benefit) => (
              <div key={benefit.title}>
                <h3 className="text-foreground font-semibold">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots (illustrative) */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-foreground text-center text-2xl font-semibold tracking-tight">
          A closer look
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-center text-sm">
          An illustrative preview of {product.name} — the product is still in
          active development, so exact screens will evolve before launch.
        </p>
        <div className="mt-10">
          <ProductMockup
            accent={product.accent}
            panels={mockupPanels[product.slug]}
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-foreground text-center text-2xl font-semibold tracking-tight">
          Pricing
        </h2>
        <div className="mt-10">
          <ProductPricingCallout product={product} />
        </div>
      </section>

      {/* FAQ */}
      {faqByProduct[product.slug] && (
        <Faq
          items={faqByProduct[product.slug]}
          title={`${product.name} frequently asked questions`}
        />
      )}

      {/* Trust points (replaces testimonials — no real customers yet) */}
      <TrustPoints product={product} />

      {/* CTA */}
      <CtaSection />
    </>
  );
}
