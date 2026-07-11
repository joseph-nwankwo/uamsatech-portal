import type { Metadata } from "next";
import { H1, Muted } from "@/components/ui/typography";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Conversion Tracking",
  robots: { index: false, follow: false },
};

export default async function AdminConversionPage() {
  const [signedUp, verifiedEmail, joinedOrg, subscribed] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { emailVerified: { not: null } } }),
    db.user.count({ where: { memberships: { some: {} } } }),
    db.user.count({
      where: {
        memberships: {
          some: {
            organization: { subscriptions: { some: { status: "ACTIVE" } } },
          },
        },
      },
    }),
  ]);

  const steps = [
    { label: "Signed up", count: signedUp },
    { label: "Verified email", count: verifiedEmail },
    { label: "Joined an organization", count: joinedOrg },
    { label: "Organization subscribed", count: subscribed },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Conversion Tracking</H1>
      <Muted className="mt-1">
        The account funnel, computed directly from real `User`/`Membership`/
        `Subscription` rows — not estimated from page-view events, since this
        app has no visitor/session tracking of its own (that lives in Google
        Analytics / Microsoft Clarity, not this database).
      </Muted>

      <div className="mt-8 space-y-3">
        {steps.map((step, i) => {
          const pctOfTop =
            signedUp === 0 ? 0 : Math.round((step.count / signedUp) * 100);
          const prevCount = i === 0 ? null : steps[i - 1].count;
          const pctOfPrev =
            prevCount === null || prevCount === 0
              ? null
              : Math.round((step.count / prevCount) * 100);

          return (
            <div
              key={step.label}
              className="border-border rounded-2xl border p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-foreground text-sm font-medium">
                  {step.label}
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {step.count}
                </p>
              </div>
              <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-navy dark:bg-blue-accent h-full rounded-full"
                  style={{ width: `${pctOfTop}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {pctOfTop}% of signups
                {pctOfPrev !== null && ` — ${pctOfPrev}% of previous step`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
