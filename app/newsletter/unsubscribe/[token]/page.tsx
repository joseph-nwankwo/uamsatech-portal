import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

async function unsubscribe(token: string) {
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { unsubscribeTokenHash: hashToken(token) },
  });
  if (!subscriber) return false;

  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribedAt: new Date() },
  });
  return true;
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const success = await unsubscribe(token);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-4 py-16 text-center">
      {success ? (
        <>
          <CheckCircle2 className="text-status-good size-10" />
          <h1 className="text-foreground mt-4 text-xl font-semibold">
            You&apos;re unsubscribed
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            You won&apos;t receive any more emails from the UAMSATech blog.
          </p>
        </>
      ) : (
        <>
          <XCircle className="text-destructive size-10" />
          <h1 className="text-foreground mt-4 text-xl font-semibold">
            Link not found
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This unsubscribe link is invalid or has already been used.
          </p>
        </>
      )}
      <Button
        variant="outline"
        className="mt-6"
        render={<Link href="/blog">Back to the blog</Link>}
      />
    </div>
  );
}
