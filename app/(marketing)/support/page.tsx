import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageCircle,
  BookOpen,
  Activity,
  ArrowRight,
  LifeBuoy,
  Bug,
  Sparkles,
} from "lucide-react";
import { H1, H3, Lead, P } from "@/components/ui/typography";
import { Faq } from "@/features/marketing/components/faq";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with UAMSA, LecturerCraft, ScholarCraft, Records, and StudyFlow.",
  alternates: { canonical: "/support" },
};

const channels = [
  {
    icon: LifeBuoy,
    title: "Knowledge base",
    description:
      "Self-service answers to common account and billing questions.",
    href: "/support/kb",
    cta: "Browse articles",
  },
  {
    icon: MessageCircle,
    title: "Support tickets",
    description: "Open a ticket and message us directly — sign in required.",
    href: "/portal/support",
    cta: "Open a ticket",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Getting-started guides for every UAMSATech product.",
    href: "/docs",
    cta: "Read the docs",
  },
  {
    icon: Activity,
    title: "System status",
    description: "Live operational status for every product and service.",
    href: "/status",
    cta: "View status",
  },
  {
    icon: Bug,
    title: "Report a bug",
    description: "Found something broken? Tell us exactly what happened.",
    href: "/support/bug-report",
    cta: "Report a bug",
  },
  {
    icon: Sparkles,
    title: "Feature requests",
    description: "See what's been requested, and vote for what matters.",
    href: "/feature-requests",
    cta: "View requests",
  },
];

const faqItems = [
  {
    question: "How quickly will I hear back from support?",
    answer:
      "We aim to respond to all support requests within one business day. Institutional plans include a dedicated onboarding contact for faster response.",
  },
  {
    question: "I forgot my password. What do I do?",
    answer:
      "Password resets are handled centrally through your UAMSATech account at auth.uamsatech.com, since the same account works across every product.",
  },
  {
    question: "Can my institution get a dedicated support contact?",
    answer:
      "Yes. Institutional plans include a dedicated onboarding and support contact — reach out through the contact page to set this up.",
  },
];

export default function SupportPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-4 text-center sm:px-6 lg:px-8">
        <H1>How can we help?</H1>
        <Lead className="mx-auto mt-6 max-w-2xl">
          Support for UAMSA, LecturerCraft, ScholarCraft, Records, and StudyFlow
          — all in one place.
        </Lead>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map(({ icon: Icon, title, description, href, cta }) => (
            <Link
              key={title}
              href={href}
              className="group border-border flex flex-col rounded-2xl border p-6"
            >
              <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-10 w-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <H3 className="mt-4 text-base">{title}</H3>
              <P className="text-muted-foreground mt-1.5 flex-1 text-sm">
                {description}
              </P>
              <span className="text-foreground mt-4 inline-flex items-center gap-1 text-sm font-medium">
                {cta}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Faq items={faqItems} title="Common support questions" />
    </>
  );
}
