import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in to UAMSATech"
      description="One account for every UAMSATech product."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
