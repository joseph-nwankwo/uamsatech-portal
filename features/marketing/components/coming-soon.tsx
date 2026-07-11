import Link from "next/link";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center sm:px-6 lg:px-8">
      <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-14 w-14 items-center justify-center rounded-2xl">
        <Construction className="size-6" />
      </div>
      <h1 className="text-foreground mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-4 text-lg">{description}</p>
      <Button
        className="bg-navy hover:bg-navy/90 mt-8 text-white"
        render={<Link href="/contact">Contact us</Link>}
      />
    </section>
  );
}
