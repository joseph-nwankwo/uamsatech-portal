import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, KeyRound, BookOpen, Package } from "lucide-react";
import { H1, Lead } from "@/components/ui/typography";
import { VersionBadge } from "@/features/docs/components/version-badge";
import { docsByCategory } from "@/features/docs";
import {
  DOC_CATEGORY_DESCRIPTIONS,
  DOC_CATEGORY_LABELS,
} from "@/features/docs/types";
import type { DocCategory } from "@/features/docs/types";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Developer docs, API reference, user guides, and product manuals for UAMSATech.",
  alternates: { canonical: "/docs" },
};

const categoryIcons: Record<DocCategory, typeof Code2> = {
  developer: Code2,
  api: KeyRound,
  guides: BookOpen,
  manuals: Package,
};

export default function DocsHomePage() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <H1 className="text-3xl sm:text-4xl">Documentation</H1>
        <VersionBadge version="v1" />
      </div>
      <Lead className="mt-3 max-w-2xl">
        Everything documented here reflects the platform as it actually exists
        today — how authentication and sessions work, the one public API
        endpoint available, how to use the customer portal, and what to expect
        from each product as it ships.
      </Lead>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(Object.keys(docsByCategory) as DocCategory[]).map((category) => {
          const Icon = categoryIcons[category];
          const pages = docsByCategory[category];
          return (
            <div
              key={category}
              className="border-border flex flex-col rounded-2xl border p-6"
            >
              <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-11 w-11 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <h2 className="text-foreground mt-4 font-semibold">
                {DOC_CATEGORY_LABELS[category]}
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                {DOC_CATEGORY_DESCRIPTIONS[category]}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5">
                {pages.slice(0, 4).map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={`/docs/${category}/${page.slug}`}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                      {page.title}
                      <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
