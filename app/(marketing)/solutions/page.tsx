import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
} from "lucide-react";
import { CtaSection } from "@/features/marketing/components/cta-section";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "UAMSATech solutions for universities, lecturers, students and researchers, and registrars.",
  alternates: { canonical: "/solutions" },
};

const solutions = [
  {
    icon: GraduationCap,
    audience: "Universities",
    description:
      "Run admissions, academics, staff, and finance on one ERP, with every other product available institution-wide.",
    products: ["UAMSA"],
  },
  {
    icon: BookOpen,
    audience: "Lecturers",
    description:
      "Cut hours of prep time with AI-generated notes, lesson plans, assignments, and exams.",
    products: ["LecturerCraft"],
  },
  {
    icon: Users,
    audience: "Students & Researchers",
    description:
      "Write theses and papers faster with AI research assistance, and stay on track with an AI study planner.",
    products: ["ScholarCraft", "StudyFlow"],
  },
  {
    icon: ClipboardList,
    audience: "Registrars & Examination Officers",
    description:
      "Generate and verify transcripts, results, and academic records at scale, standalone or integrated with your SIS.",
    products: ["Records"],
  },
];

export default function SolutionsPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-24 pb-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Built for every role in higher education
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          Whichever seat you sit in, there&apos;s a UAMSATech product designed
          around how you actually work.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {solutions.map(({ icon: Icon, audience, description, products }) => (
            <div
              key={audience}
              className="border-border rounded-2xl border p-8"
            >
              <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-11 w-11 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <h2 className="text-foreground mt-4 text-xl font-semibold">
                {audience}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {description}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {products.map((name) => (
                  <Link
                    key={name}
                    href={`/products/${name.toLowerCase()}`}
                    className="text-foreground inline-flex items-center gap-1 text-sm font-medium"
                  >
                    {name}
                    <ArrowRight className="size-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaSection />
    </>
  );
}
