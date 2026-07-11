import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { trackEvent } from "@/lib/analytics/track";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

async function verifyEmailToken(token: string) {
  const verification = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (
    !verification ||
    verification.type !== "EMAIL_VERIFICATION" ||
    verification.consumedAt ||
    verification.expiresAt.getTime() < Date.now()
  ) {
    return false;
  }

  await db.$transaction([
    db.user.update({
      where: { id: verification.userId },
      data: { emailVerified: new Date() },
    }),
    db.verificationToken.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    }),
  ]);
  await trackEvent("email_verified", { userId: verification.userId });

  return true;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const verified = token ? await verifyEmailToken(token) : false;

  return (
    <AuthShell title="Email verification">
      <div className="flex flex-col items-center gap-3 text-center">
        {verified ? (
          <>
            <CheckCircle2 className="text-navy dark:text-blue-accent size-10" />
            <p className="text-muted-foreground text-sm">
              Your email is verified.
            </p>
            <Button
              className="bg-navy hover:bg-navy/90 mt-2 w-full text-white"
              render={<Link href="/portal/dashboard">Go to dashboard</Link>}
            />
          </>
        ) : (
          <>
            <XCircle className="text-destructive size-10" />
            <p className="text-muted-foreground text-sm">
              This verification link is invalid or has expired.
            </p>
            <Button
              variant="outline"
              className="mt-2 w-full"
              render={<Link href="/login">Back to sign in</Link>}
            />
          </>
        )}
      </div>
    </AuthShell>
  );
}
