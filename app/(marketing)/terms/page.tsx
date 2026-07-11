import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of UAMSATech products.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-foreground text-4xl font-semibold tracking-tight">
        Terms of Service
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: draft — final version pending legal review.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-lg font-semibold">1. Acceptance of terms</h2>
          <p className="text-muted-foreground mt-2">
            By creating a {siteConfig.name} account or using any UAMSATech
            product — UAMSA, LecturerCraft, ScholarCraft, Records, or StudyFlow
            — you agree to these terms.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. Accounts</h2>
          <p className="text-muted-foreground mt-2">
            A single UAMSATech account, authenticated centrally, grants access
            to every product you or your institution are subscribed to. You are
            responsible for keeping your credentials secure.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Subscriptions & billing</h2>
          <p className="text-muted-foreground mt-2">
            Paid plans are billed as agreed at signup or in your institutional
            contract, processed through Stripe, Paystack, or Flutterwave. Fees
            are non-refundable except as required by law.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. Acceptable use</h2>
          <p className="text-muted-foreground mt-2">
            You agree not to misuse our products, attempt to access data you are
            not authorized to view, or interfere with the normal operation of
            any UAMSATech service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. Data ownership</h2>
          <p className="text-muted-foreground mt-2">
            Institutions and individuals retain ownership of the academic
            content and records they create within our products.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">6. Termination</h2>
          <p className="text-muted-foreground mt-2">
            We may suspend or terminate access for violation of these terms. You
            may cancel your subscription at any time in accordance with your
            plan terms.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">7. Contact</h2>
          <p className="text-muted-foreground mt-2">
            Questions about these terms can be sent through our{" "}
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
