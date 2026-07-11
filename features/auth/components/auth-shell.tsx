import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm flex-col justify-center px-4 py-16">
      <Link
        href="/"
        className="mx-auto flex items-center gap-2 font-semibold tracking-tight"
      >
        <span className="bg-navy flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
          U
        </span>
        <span className="text-lg">UAMSATech</span>
      </Link>

      <h1 className="text-foreground mt-8 text-center text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground mt-2 text-center text-sm">
          {description}
        </p>
      )}

      <div className="border-border bg-card mt-8 rounded-2xl border p-6">
        {children}
      </div>
    </div>
  );
}
