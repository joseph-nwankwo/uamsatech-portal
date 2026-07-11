"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "@/features/docs";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 space-y-6">
      {docsNav.map((group) => (
        <div key={group.category}>
          <p className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
            {group.label}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.pages.map((page) => {
              const href = `/docs/${group.category}/${page.slug}`;
              const isActive = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    className={
                      isActive
                        ? "bg-accent text-accent-foreground block rounded-lg px-2 py-1.5 text-sm font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground block rounded-lg px-2 py-1.5 text-sm"
                    }
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
