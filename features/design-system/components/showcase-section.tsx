import type { ReactNode } from "react";

export function ShowcaseSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-b py-14">
      <div className="mb-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
