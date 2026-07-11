import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell title="Reset your password">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          This reset link is missing a token. Request a new one from the{" "}
          <a
            href="/forgot-password"
            className="text-foreground font-medium underline"
          >
            forgot password
          </a>{" "}
          page.
        </p>
      )}
    </AuthShell>
  );
}
