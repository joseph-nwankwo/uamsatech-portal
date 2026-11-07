import type { Metadata } from "next";
import { Mail, MessageSquare, Building2 } from "lucide-react";
import { ContactForm } from "@/features/marketing/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the UAMSATech team about UAMSA, LectureSuite, ScholarSuite, Records, or StudyFlow.",
  alternates: { canonical: "/contact" },
};

const channels = [
  {
    icon: Building2,
    title: "For universities",
    description: "Deploying UAMSA or rolling out products institution-wide.",
  },
  {
    icon: MessageSquare,
    title: "For individuals",
    description: "Questions about LectureSuite, ScholarSuite, or StudyFlow.",
  },
  {
    icon: Mail,
    title: "Everything else",
    description: "Partnerships, press, and general inquiries.",
  },
];

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <div>
          <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
            Let&apos;s talk
          </h1>
          <p className="text-muted-foreground mt-6 max-w-md text-lg">
            Tell us about your institution or team, and we&apos;ll help you find
            the right products and plan.
          </p>

          <div className="mt-10 space-y-6">
            {channels.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border bg-card rounded-2xl border p-8">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
