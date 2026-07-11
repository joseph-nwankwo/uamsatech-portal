import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Sparkles, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, H2, Lead, P } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the team building UAMSATech's academic software ecosystem.",
  alternates: { canonical: "/careers" },
};

const values = [
  {
    icon: Sparkles,
    title: "Simplicity",
    description: "We'd rather ship one thing that works than five that don't.",
  },
  {
    icon: ShieldCheck,
    title: "Reliability",
    description:
      "Our products run during exams and registration — uptime isn't optional.",
  },
  {
    icon: Users,
    title: "User-centered design",
    description:
      "We build with lecturers, registrars, and students, not just for them.",
  },
];

export default function CareersPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-4 text-center sm:px-6 lg:px-8">
        <H1>Careers at UAMSATech</H1>
        <Lead className="mx-auto mt-6 max-w-2xl">
          We&apos;re building an intelligent software ecosystem for higher
          education across Africa. Here&apos;s what it&apos;s like to work on
          it.
        </Lead>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {values.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-11 w-11 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <H2 className="mt-4 text-lg sm:text-lg">{title}</H2>
              <P className="text-muted-foreground mt-1.5 text-sm">
                {description}
              </P>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
        <EmptyState
          icon={Briefcase}
          title="No open roles right now"
          description="We're not actively hiring at the moment, but we're always happy to hear from people passionate about education technology in Africa. Send us a note and we'll reach out when a relevant role opens."
          action={
            <Button
              className="bg-navy hover:bg-navy/90 text-white"
              render={<Link href="/contact">Get in touch</Link>}
            />
          }
        />
      </section>
    </>
  );
}
