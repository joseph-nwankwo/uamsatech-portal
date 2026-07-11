import type { Metadata } from "next";
import Link from "next/link";
import {
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { H1, H2, Lead, P } from "@/components/ui/typography";
import { CtaSection } from "@/features/marketing/components/cta-section";

export const metadata: Metadata = {
  title: "Customers",
  description:
    "UAMSATech is built for universities, lecturers, students, researchers, and registrars across Africa. See who we serve and how to become a founding partner.",
  alternates: { canonical: "/customers" },
};

const outcomes = [
  {
    icon: GraduationCap,
    audience: "Universities",
    outcome:
      "Run admissions through graduation on one ERP, with every satellite product available institution-wide under a single account.",
  },
  {
    icon: BookOpen,
    audience: "Lecturers",
    outcome:
      "Cut hours of weekly prep with AI-generated lecture notes, assignments, and exams — starting free, individually.",
  },
  {
    icon: Users,
    audience: "Students & researchers",
    outcome:
      "Move from proposal to publication faster, and stay on top of coursework with an AI study companion.",
  },
  {
    icon: ClipboardList,
    audience: "Registrars",
    outcome:
      "Generate and verify transcripts and results at scale, whether or not your institution runs UAMSA.",
  },
];

export default function CustomersPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-4 text-center sm:px-6 lg:px-8">
        <H1>Built for the people running higher education</H1>
        <Lead className="mx-auto mt-6 max-w-2xl">
          UAMSATech is early — we&apos;re working directly with a first group of
          universities, lecturers, and registrars to shape the product.
          Here&apos;s who we&apos;re building for, and how to get involved.
        </Lead>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {outcomes.map(({ icon: Icon, audience, outcome }) => (
            <div
              key={audience}
              className="border-border rounded-2xl border p-8"
            >
              <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-11 w-11 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <H2 className="mt-4 text-xl sm:text-xl">{audience}</H2>
              <P className="text-muted-foreground mt-2 text-sm">{outcome}</P>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <H2>Become a founding partner</H2>
        <P className="text-muted-foreground mx-auto mt-4 max-w-xl">
          We&apos;re selecting a small number of universities and individual
          lecturers to work closely with as founding partners — direct input
          into the roadmap, hands-on onboarding, and preferred pricing.
        </P>
        <Button
          size="lg"
          className="bg-navy hover:bg-navy/90 mt-8 text-white"
          render={
            <Link href="/contact">
              Apply as a founding partner
              <ArrowRight className="size-4" />
            </Link>
          }
        />
      </section>

      <CtaSection />
    </>
  );
}
