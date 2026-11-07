import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How UAMSATech collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-foreground text-4xl font-semibold tracking-tight">
        Privacy Policy
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: draft — final version pending legal review.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-lg font-semibold">1. Information we collect</h2>
          <p className="text-muted-foreground mt-2">
            We collect account information (name, email, institution), usage
            data, and content you create within {siteConfig.name} products, such
            as UAMSA, LectureSuite, ScholarSuite, Records, and StudyFlow.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. How we use information</h2>
          <p className="text-muted-foreground mt-2">
            We use your information to provide and improve our products, process
            billing through Stripe, Paystack, or Flutterwave, and communicate
            important account and service updates.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Data storage & security</h2>
          <p className="text-muted-foreground mt-2">
            Each product maintains its own isolated database. Authentication is
            centralized and encrypted, and access to your data is restricted by
            role-based permissions.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. Data sharing</h2>
          <p className="text-muted-foreground mt-2">
            We do not sell your personal data. Data is shared only with service
            providers necessary to operate our products (such as payment and
            email delivery providers) and as required by law.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. Your rights</h2>
          <p className="text-muted-foreground mt-2">
            You may request access to, correction of, or deletion of your
            personal data at any time by contacting us.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">6. Contact</h2>
          <p className="text-muted-foreground mt-2">
            Questions about this policy can be sent through our{" "}
            <a
              href="/contact"
              className="text-foreground font-medium underline"
            >
              contact page
            </a>
            .
          </p>
        </section>
      </div>
    </section>
  );
}
