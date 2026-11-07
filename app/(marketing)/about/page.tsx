import type { Metadata } from "next";
import { Rocket, Target, HeartHandshake } from "lucide-react";
import { CtaSection } from "@/features/marketing/components/cta-section";

export const metadata: Metadata = {
  title: "About",
  description:
    "UAMSATech's vision, mission, and the team building Africa's leading ecosystem of intelligent education technology.",
  alternates: { canonical: "/about" },
};

const values = [
  "Simplicity",
  "Reliability",
  "Innovation",
  "Security",
  "Scalability",
  "User-Centered Design",
  "Academic Excellence",
];

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Building the operating system for higher education
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          UAMSATech is the parent platform behind UAMSA, LectureSuite,
          ScholarSuite, Records, and StudyFlow &mdash; one account, one billing
          relationship, five products built for academia.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="border-border rounded-2xl border p-8">
            <Target className="text-navy dark:text-blue-accent size-6" />
            <h2 className="text-foreground mt-4 text-xl font-semibold">
              Vision
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              To become Africa&apos;s leading provider of intelligent education
              technology solutions by building a unified ecosystem of AI-powered
              academic software.
            </p>
          </div>
          <div className="border-border rounded-2xl border p-8">
            <Rocket className="text-navy dark:text-blue-accent size-6" />
            <h2 className="text-foreground mt-4 text-xl font-semibold">
              Mission
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Empower universities, lecturers, researchers, registrars, and
              students with intelligent software that simplifies teaching,
              learning, research, administration, and academic records
              management.
            </p>
          </div>
          <div className="border-border rounded-2xl border p-8">
            <HeartHandshake className="text-navy dark:text-blue-accent size-6" />
            <h2 className="text-foreground mt-4 text-xl font-semibold">
              Values
            </h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {values.map((v) => (
                <li
                  key={v}
                  className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs"
                >
                  {v}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
