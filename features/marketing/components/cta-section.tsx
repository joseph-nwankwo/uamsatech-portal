import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="bg-navy relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,color-mix(in_oklch,var(--brand-blue)_35%,transparent),transparent)]"
        />
        <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to modernize your institution?
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">
          Talk to our team about UAMSA, or get started with LectureSuite,
          ScholarSuite, StudyFlow, or Records today.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="bg-gold text-navy hover:bg-gold/90"
            render={
              <Link href="/contact">
                Talk to sales
                <ArrowRight className="size-4" />
              </Link>
            }
          />
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            render={<Link href="/pricing">View pricing</Link>}
          />
        </div>
      </div>
    </section>
  );
}
