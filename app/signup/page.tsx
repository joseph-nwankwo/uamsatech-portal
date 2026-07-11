import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      description="One account for every UAMSATech product."
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
