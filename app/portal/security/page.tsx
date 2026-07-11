import type { Metadata } from "next";
import { cookies } from "next/headers";
import { H1, H3 } from "@/components/ui/typography";
import { ChangePasswordForm } from "@/features/portal/components/change-password-form";
import { SessionsList } from "@/features/portal/components/sessions-list";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  const { user } = await getPortalContext();

  const store = await cookies();
  const currentRefreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const currentTokenHash = currentRefreshToken
    ? hashToken(currentRefreshToken)
    : null;

  const sessions = await db.refreshToken.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <H1 className="text-2xl sm:text-2xl">Security</H1>
      </div>

      <div>
        <H3>Password</H3>
        <div className="border-border mt-4 rounded-2xl border p-6">
          <ChangePasswordForm />
        </div>
      </div>

      <div>
        <H3>Active sessions</H3>
        <div className="mt-4">
          <SessionsList
            sessions={sessions.map((s) => ({
              id: s.id,
              createdAt: s.createdAt.toISOString(),
              expiresAt: s.expiresAt.toISOString(),
              isCurrent: s.tokenHash === currentTokenHash,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
