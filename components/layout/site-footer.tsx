import Link from "next/link";
import { footerNav, siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="border-border/60 bg-background border-t">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <span className="bg-navy flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
                U
              </span>
              <span className="text-lg">{siteConfig.name}</span>
            </Link>
            <p className="text-muted-foreground mt-4 max-w-xs text-sm">
              {siteConfig.tagline} Building Africa&apos;s leading ecosystem of
              intelligent education technology.
            </p>
          </div>

          {Object.entries(footerNav).map(([section, items]) => (
            <div key={section}>
              <h3 className="text-foreground text-sm font-semibold">
                {section}
              </h3>
              <ul className="mt-4 space-y-3">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border/60 mt-16 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
          <p className="text-muted-foreground text-sm">
            Made for higher education in Africa.
          </p>
        </div>
      </div>
    </footer>
  );
}
