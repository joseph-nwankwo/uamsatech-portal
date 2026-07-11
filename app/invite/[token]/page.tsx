import type { Metadata } from "next";
import Link from "next/link";
import { XCircle, Building2 } from "lucide-react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { AcceptInvitationButton } from "@/features/portal/components/accept-invitation-button";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
  title: "Accept invitation",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true, invitedBy: true },
  });

  const isValid =
    invitation &&
    !invitation.revokedAt &&
    !invitation.acceptedAt &&
    invitation.expiresAt > new Date();

  if (!isValid) {
    return (
      <AuthShell title="Invitation">
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="text-destructive size-10" />
          <p className="text-muted-foreground text-sm">
            {invitation?.acceptedAt
              ? "This invitation has already been accepted."
              : "This invitation is invalid, revoked, or has expired."}
          </p>
          <Button
            variant="outline"
            className="mt-2 w-full"
            render={<Link href="/login">Back to sign in</Link>}
          />
        </div>
      </AuthShell>
    );
  }

  const session = await getSession();
  const currentUser = session
    ? await db.user.findUnique({ where: { id: session.sub } })
    : null;

  const redirectUri = `/invite/${token}`;

  return (
    <AuthShell title="You've been invited">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-11 w-11 items-center justify-center rounded-lg">
          <Building2 className="size-5" />
        </div>
        <p className="text-foreground text-sm">
          <strong>
            {invitation.invitedBy.name ?? invitation.invitedBy.email}
          </strong>{" "}
          invited you to join <strong>{invitation.organization.name}</strong> as{" "}
          {invitation.role.toLowerCase()}.
        </p>

        {!currentUser ? (
          <div className="mt-2 flex w-full flex-col gap-2">
            <Button
              className="bg-navy hover:bg-navy/90 w-full text-white"
              render={
                <Link
                  href={`/signup?redirect_uri=${encodeURIComponent(redirectUri)}`}
                >
                  Create an account
                </Link>
              }
            />
            <Button
              variant="outline"
              className="w-full"
              render={
                <Link
                  href={`/login?redirect_uri=${encodeURIComponent(redirectUri)}`}
                >
                  Sign in
                </Link>
              }
            />
          </div>
        ) : currentUser.email.toLowerCase() !==
          invitation.email.toLowerCase() ? (
          <div className="mt-2 w-full space-y-3">
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
              This invitation was sent to {invitation.email}, but you&apos;re
              signed in as {currentUser.email}.
            </p>
            <Button
              variant="outline"
              className="w-full"
              render={
                <Link
                  href={`/login?redirect_uri=${encodeURIComponent(redirectUri)}`}
                >
                  Sign in with a different account
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-2 w-full">
            <AcceptInvitationButton token={token} />
          </div>
        )}
      </div>
    </AuthShell>
  );
}
