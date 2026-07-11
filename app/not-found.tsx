import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Button
        className="bg-navy hover:bg-navy/90 mt-6 text-white"
        render={<Link href="/">Back home</Link>}
      />
    </div>
  );
}
