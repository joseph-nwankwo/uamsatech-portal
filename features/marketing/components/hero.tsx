"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, transitionDefault } from "@/lib/motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklch,var(--brand-blue)_18%,transparent),transparent)]"
      />
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="mx-auto max-w-7xl px-4 pt-24 pb-20 text-center sm:px-6 sm:pt-32 lg:px-8"
      >
        <motion.div
          variants={fadeInUp}
          transition={transitionDefault}
          className="border-border bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
        >
          <Sparkles className="size-3.5" />
          Five products. One academic ecosystem.
        </motion.div>

        <motion.h1
          variants={fadeInUp}
          transition={transitionDefault}
          className="text-foreground mx-auto mt-8 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
        >
          Intelligent software for higher education
        </motion.h1>

        <motion.p
          variants={fadeInUp}
          transition={transitionDefault}
          className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-balance"
        >
          UAMSATech gives universities, lecturers, researchers, registrars, and
          students a unified platform for teaching, learning, research, and
          academic administration &mdash; powered by AI.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          transition={transitionDefault}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            className="bg-navy hover:bg-navy/90 text-white"
            render={
              <Link href="/products">
                Explore products
                <ArrowRight className="size-4" />
              </Link>
            }
          />
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/contact">Talk to sales</Link>}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
