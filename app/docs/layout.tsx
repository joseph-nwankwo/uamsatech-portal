import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocsSidebar } from "@/features/docs/components/docs-sidebar";
import { DocsSearch } from "@/features/docs/components/docs-search";
import { siteConfig } from "@/lib/site-config";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/docs"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="bg-navy flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
              U
            </span>
            <span className="text-lg">{siteConfig.name} Docs</span>
          </Link>
          <div className="flex items-center gap-3">
            <DocsSearch />
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-sm font-medium sm:flex"
            >
              <ArrowLeft className="size-3.5" />
              Back to site
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="hidden shrink-0 lg:block">
          <DocsSidebar />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
