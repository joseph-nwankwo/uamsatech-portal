import { Hero } from "@/features/marketing/components/hero";
import { Integrations } from "@/features/marketing/components/integrations";
import { ProductGrid } from "@/features/marketing/components/product-grid";
import { Values } from "@/features/marketing/components/values";
import { Faq } from "@/features/marketing/components/faq";
import { CtaSection } from "@/features/marketing/components/cta-section";

const faqItems = [
  {
    question: "Do I need one account for every product?",
    answer:
      "Yes. A single UAMSATech account, secured through central authentication at auth.uamsatech.com, gives you single sign-on access to every product you're subscribed to — UAMSA, LectureSuite, ScholarSuite, Records, and StudyFlow.",
  },
  {
    question: "Can institutions use products individually?",
    answer:
      "Every product works standalone. UAMSA is institution-only, while LectureSuite, ScholarSuite, StudyFlow, and Records can be used individually or by an institution, and all integrate with UAMSA when you use more than one.",
  },
  {
    question: "Is my institution's data secure?",
    answer:
      "Each product maintains its own isolated database, access is role-based, and authentication is centralized and encrypted end-to-end.",
  },
  {
    question: "Which regions do you support?",
    answer:
      "UAMSATech is built for higher education institutions across Africa, with support for local payment providers including Paystack and Flutterwave alongside Stripe.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />
      <Integrations />
      <ProductGrid />
      <Values />
      <Faq items={faqItems} />
      <CtaSection />
    </>
  );
}
