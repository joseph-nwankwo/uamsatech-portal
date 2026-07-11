import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types/product";

const accentClasses: Record<Product["accent"], string> = {
  navy: "bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent",
  gold: "bg-gold/15 text-[#8a6d10] dark:text-gold",
  blue: "bg-blue-accent/10 text-blue-accent",
};

export function ProductMockup({
  accent,
  panels,
}: {
  accent: Product["accent"];
  panels: { icon: LucideIcon; label: string }[];
}) {
  return (
    <div
      aria-hidden
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm"
    >
      <div className="border-border flex items-center gap-1.5 border-b px-4 py-3">
        <span className="bg-muted size-2.5 rounded-full" />
        <span className="bg-muted size-2.5 rounded-full" />
        <span className="bg-muted size-2.5 rounded-full" />
      </div>
      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr]">
        <div className="border-border bg-muted/30 flex flex-col items-center gap-4 border-r py-6">
          {panels.map((p, i) => (
            <div
              key={i}
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentClasses[accent]}`}
            >
              <p.icon className="size-4" />
            </div>
          ))}
        </div>
        <div className="space-y-6 p-6">
          {panels.map((p, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentClasses[accent]}`}
              >
                <p.icon className="size-4" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-foreground text-sm font-medium">{p.label}</p>
                <Skeleton className="h-2.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
